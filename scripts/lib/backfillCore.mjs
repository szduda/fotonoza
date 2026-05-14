import { execFile } from "node:child_process";
import { URL } from "node:url";
import { promisify } from "node:util";
import { gitExec, gitExecRaw } from "./gitExec.mjs";
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
 * @param {{ fotonozaRoot: string; slug: string; flags: { commit: boolean; push: boolean; noPr: boolean } }} p
 */
export async function maybeGitCommitPushPr(p) {
  const { fotonozaRoot, slug, flags } = p;
  if (!flags.commit) return;
  const branch = `progress/backfill-${slug}`;
  console.log(`[git] branch ${branch}`);
  await gitExec(fotonozaRoot, ["checkout", "-B", branch]);
  await gitExec(fotonozaRoot, ["add", "src/content/progress", "public/progress"]);

  const diffR = await gitExecRaw(fotonozaRoot, ["diff", "--cached", "--quiet"]);
  if (diffR.exitCode === 0) {
    console.log("[git] nothing to commit (already committed?)");
    return;
  }
  if (diffR.exitCode !== 1) {
    const err = new Error(diffR.stderr.trim() || `git diff exited ${diffR.exitCode}`);
    err.code = diffR.exitCode;
    throw err;
  }

  await gitExec(fotonozaRoot, ["commit", "-m", `progress: backfill ${slug}`]);
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
    await gitExec(fotonozaRoot, ["push", siteGitUrl, `HEAD:refs/heads/${branch}`]);
  } else {
    await gitExec(fotonozaRoot, ["push", "-u", "origin", branch]);
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
        `Automated backfill post \`${slug}\`.`
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
