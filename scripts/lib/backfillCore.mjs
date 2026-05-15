import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseYyMmDdHhMmUtc } from "./parseYyMmDdHhMm.mjs";
import { runProgressPipeline } from "./runProgressPipeline.mjs";

const execFileAsync = promisify(execFile);

/**
 * @param {string} root
 * @param {string[]} args
 */
async function git(root, args) {
  await execFileAsync("git", ["-C", root, ...args], { maxBuffer: 50 * 1024 * 1024 });
}

/**
 * @param {string} root
 * @returns {Promise<0|1>} 0 = empty index, 1 = staged changes, throws on other errors
 */
async function gitDiffCachedExitCode(root) {
  try {
    await execFileAsync("git", ["-C", root, "diff", "--cached", "--quiet"], {
      maxBuffer: 10 * 1024 * 1024
    });
    return 0;
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? /** @type {{ code?: number }} */ (e).code : undefined;
    if (code === 1) return 1;
    throw e;
  }
}

/**
 * @param {string} root
 * @param {string} branch
 */
async function remoteBranchExists(root, branch) {
  try {
    const { stdout } = await execFileAsync("git", ["-C", root, "ls-remote", "--heads", "origin", branch], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    });
    return Boolean(stdout.trim());
  } catch {
    return false;
  }
}

/**
 * Push (or update) `branch` on `origin`. Rebases onto existing remote tip when possible;
 * on rebase conflict falls back to force-with-lease so CI can refresh bot-owned branches.
 * @param {string} root
 * @param {string} branch
 */
async function gitPushOriginBranch(root, branch) {
  if (await remoteBranchExists(root, branch)) {
    try {
      await git(root, ["pull", "--rebase", "origin", branch]);
      console.log(`[git] rebased onto origin/${branch}`);
    } catch (e) {
      const note = e instanceof Error ? e.message : String(e);
      console.warn("[git] pull --rebase failed:", note);
      try {
        await git(root, ["rebase", "--abort"]);
      } catch {
        /* not in a rebase */
      }
      await git(root, ["push", "--force-with-lease", "-u", "origin", branch]);
      console.warn(
        "[git] pushed with --force-with-lease (rebase had conflicts or could not apply; remote-only commits on this branch may have been dropped)"
      );
      return;
    }
  }
  await git(root, ["push", "-u", "origin", branch]);
}

/**
 * @param {string} root
 * @param {string} branch
 * @param {string[]} ghArgs
 * @param {NodeJS.ProcessEnv} ghEnv
 */
async function ghPrCreateIfMissing(root, branch, ghArgs, ghEnv) {
  try {
    const { stdout } = await execFileAsync(
      "gh",
      ["pr", "list", "--head", branch, "--state", "open", "--json", "number"],
      { cwd: root, env: ghEnv, encoding: "utf8", maxBuffer: 1024 * 1024 }
    );
    const parsed = JSON.parse(stdout || "[]");
    if (Array.isArray(parsed) && parsed.length > 0) {
      console.log(`[git] open PR already exists for branch ${branch}; skip gh pr create`);
      return;
    }
  } catch (e) {
    console.warn("[git] gh pr list failed; will still try gh pr create:", e instanceof Error ? e.message : e);
  }
  const { stdout } = await execFileAsync("gh", ghArgs, { cwd: root, env: ghEnv, maxBuffer: 1024 * 1024 });
  console.log(stdout.trim());
}

/**
 * @param {{ fotonozaRoot: string; slug: string; flags: { commit: boolean; push: boolean; noPr: boolean } }} p
 */
export async function maybeGitCommitPushPr(p) {
  const { fotonozaRoot, slug, flags } = p;
  if (!flags.commit) return;
  const branchPrefix =
    (process.env.PROGRESS_BRANCH_PREFIX && process.env.PROGRESS_BRANCH_PREFIX.trim()) || "progress/backfill-";
  const branch = `${branchPrefix}${slug}`;
  const commitMsg =
    (process.env.PROGRESS_COMMIT_MSG && process.env.PROGRESS_COMMIT_MSG.trim()) ||
    (branchPrefix.includes("ci") ? `progress: ci ${slug}` : `progress: backfill ${slug}`);
  const prBody =
    (process.env.PROGRESS_PR_BODY && process.env.PROGRESS_PR_BODY.trim()) ||
    (branchPrefix.includes("ci")
      ? `Automated progress post \`${slug}\` (English and Polish markdown under \`src/content/progress/\`).`
      : `Automated backfill post \`${slug}\`.`);
  console.log(`[git] branch ${branch}`);
  await git(fotonozaRoot, ["checkout", "-B", branch]);
  await git(fotonozaRoot, ["add", "src/content/progress", "public/progress"]);

  const diffExit = await gitDiffCachedExitCode(fotonozaRoot);
  if (diffExit === 0) {
    console.log("[git] nothing to commit (already committed?)");
    return;
  }

  await git(fotonozaRoot, ["commit", "-m", commitMsg]);
  if (!flags.push) {
    console.log("[git] committed on", branch, "(omit --push to stop here)");
    return;
  }

  const inGithubActions = process.env.GITHUB_ACTIONS === "true";

  await gitPushOriginBranch(fotonozaRoot, branch);

  if (flags.noPr) return;

  const prBase = process.env.PROGRESS_PR_BASE?.trim();
  const ghArgs = ["pr", "create", "--head", branch, "--title", `Progress: ${slug}`, "--body", prBody];
  if (prBase) {
    ghArgs.splice(2, 0, "--base", prBase);
  }

  const ghEnv = { ...process.env };
  const prCreatePat = process.env.GH_PR_CREATE_TOKEN?.trim();
  if (prCreatePat) {
    ghEnv.GH_TOKEN = prCreatePat;
    if (inGithubActions) {
      console.log("[git] gh pr create: using GH_PR_CREATE_TOKEN (PAT) for GitHub API.");
    }
  }

  try {
    await ghPrCreateIfMissing(fotonozaRoot, branch, ghArgs, ghEnv);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stderr =
      e && typeof e === "object" && "stderr" in e ? String(/** @type {{ stderr?: unknown }} */ (e).stderr) : "";
    const detail = [msg, stderr].filter(Boolean).join("\n");
    if (/already exists|pull request already exists|A pull request already/i.test(detail)) {
      console.log("[git] gh pr create skipped (PR already exists):", detail);
      return;
    }
    if (inGithubActions) {
      console.error("[git] gh pr create failed in Actions:\n", detail);
      const hint =
        /not permitted to create or approve pull requests/i.test(detail)
          ? " Enable: repo Settings → Actions → General → Workflow permissions → “Read and write permissions” and check “Allow GitHub Actions to create and approve pull requests”. Or add repository secret GH_PR_CREATE_TOKEN (PAT with Pull requests: Write on this repo) for gh only."
          : "";
      throw new Error(`gh pr create failed: ${detail}${hint}`);
    }
    console.warn("[git] gh pr create failed (install gh and auth, or pass --no-pr):", detail);
  }
}

/**
 * @param {{
 *   startToken: string;
 *   endToken: string;
 *   apiKey: string;
 *   fotonozaRoot: string;
 *   appRoot: string;
 *   flags: { commit: boolean; push: boolean; noPr: boolean };
 * }} opts
 * @returns {Promise<
 *   | { outcome: "ok"; slug: string }
 *   | { outcome: "no_commits"; message: string }
 * >}
 */
export async function runBackfillRange(opts) {
  const startUtc = parseYyMmDdHhMmUtc(opts.startToken);
  const endUtc = parseYyMmDdHhMmUtc(opts.endToken);
  if (startUtc.getTime() > endUtc.getTime()) {
    throw new Error("Start instant must be <= end instant (UTC).");
  }

  const pipeline = await runProgressPipeline({
    apiKey: opts.apiKey,
    fotonozaRoot: opts.fotonozaRoot,
    appRoot: opts.appRoot,
    rangeStartToken: opts.startToken,
    rangeEndToken: opts.endToken,
    startUtc,
    endUtc
  });

  if (!pipeline.ok) {
    return { outcome: "no_commits", message: pipeline.message };
  }

  await maybeGitCommitPushPr({
    fotonozaRoot: opts.fotonozaRoot,
    slug: pipeline.slug,
    flags: opts.flags
  });

  return { outcome: "ok", slug: pipeline.slug };
}
