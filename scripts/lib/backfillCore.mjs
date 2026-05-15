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

  await git(fotonozaRoot, ["push", "-u", "origin", branch]);

  if (flags.noPr) return;

  const prBase = process.env.PROGRESS_PR_BASE?.trim();
  const ghArgs = ["pr", "create", "--head", branch, "--title", `Progress: ${slug}`, "--body", prBody];
  if (prBase) {
    ghArgs.splice(2, 0, "--base", prBase);
  }

  try {
    const ghEnv = { ...process.env };
    const prCreatePat = process.env.GH_PR_CREATE_TOKEN?.trim();
    if (prCreatePat) {
      ghEnv.GH_TOKEN = prCreatePat;
      if (inGithubActions) {
        console.log("[git] gh pr create: using GH_PR_CREATE_TOKEN (PAT) for GitHub API.");
      }
    }
    const { stdout } = await execFileAsync("gh", ghArgs, {
      cwd: fotonozaRoot,
      env: ghEnv
    });
    console.log(stdout.trim());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stderr =
      e && typeof e === "object" && "stderr" in e ? String(/** @type {{ stderr?: unknown }} */ (e).stderr) : "";
    const detail = [msg, stderr].filter(Boolean).join("\n");
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
