import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseYyMmDdHhMmUtc } from "./parseYyMmDdHhMm.mjs";
import { runProgressPipeline } from "./runProgressPipeline.mjs";

const execFileAsync = promisify(execFile);

/**
 * @param {{ fotonozaRoot: string; slug: string; flags: { commit: boolean; push: boolean; noPr: boolean } }} p
 */
export async function maybeGitCommitPushPr(p) {
  const { fotonozaRoot, slug, flags } = p;
  if (!flags.commit) return;
  const branch = `progress/backfill-${slug}`;
  console.log(`[git] branch ${branch}`);
  await execFileAsync("git", ["-C", fotonozaRoot, "checkout", "-B", branch]);
  await execFileAsync("git", ["-C", fotonozaRoot, "add", "src/content/progress", "public/progress"]);
  try {
    await execFileAsync("git", ["-C", fotonozaRoot, "diff", "--cached", "--quiet"]);
    console.log("[git] nothing to commit (already committed?)");
    return;
  } catch (e) {
    const code = typeof e === "object" && e && "code" in e ? e.code : undefined;
    if (code !== 1) throw e;
  }
  await execFileAsync("git", ["-C", fotonozaRoot, "commit", "-m", `progress: backfill ${slug}`]);
  if (!flags.push) {
    console.log("[git] committed on", branch, "(omit --push to stop here)");
    return;
  }
  await execFileAsync("git", ["-C", fotonozaRoot, "push", "-u", "origin", branch]);
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
