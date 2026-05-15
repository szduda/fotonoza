import { execFile } from "node:child_process";
import { URL } from "node:url";
import { promisify } from "node:util";
import { parseYyMmDdHhMmUtc } from "./parseYyMmDdHhMm.mjs";
import { runProgressPipeline } from "./runProgressPipeline.mjs";

const execFileAsync = promisify(execFile);

/**
 * PAT from `https://x-access-token:<pat>@host/...` for non-interactive `gh`.
 * @param {string} urlStr
 */
function patFromXAccessTokenUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.password || "";
  } catch {
    return "";
  }
}

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
      ? `Automated progress post \`${slug}\`.\n\n**Before merge:** add the cover PNG at \`public/progress/${slug}.png\` (same path as in the post). The PR check will fail until that file is in the diff.`
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

  const siteGitUrl = process.env.FOTONOZA_GIT_URL?.trim();
  const pat = siteGitUrl ? patFromXAccessTokenUrl(siteGitUrl) : "";
  if (pat && !process.env.GH_TOKEN) {
    process.env.GH_TOKEN = pat;
  }

  if (siteGitUrl) {
    await git(fotonozaRoot, ["push", siteGitUrl, `HEAD:refs/heads/${branch}`]);
  } else {
    await git(fotonozaRoot, ["push", "-u", "origin", branch]);
  }

  if (flags.noPr) return;
  try {
    const { stdout } = await execFileAsync(
      "gh",
      [
        "pr",
        "create",
        "--head",
        branch,
        "--title",
        `Progress: ${slug}`,
        "--body",
        prBody
      ],
      { cwd: fotonozaRoot }
    );
    console.log(stdout.trim());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[git] gh pr create failed (install gh and auth, or pass --no-pr):", msg);
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
