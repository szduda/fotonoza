import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * List commits in `appRoot` whose **author date** (Unix seconds) lies in
 * `[startInclusive, endInclusive]` on the current HEAD history, oldest first.
 * @param {{ appRoot: string; startInclusive: Date; endInclusive: Date }} opts
 */
export async function listCommitsByAuthorDateInRange(opts) {
  const { appRoot, startInclusive, endInclusive } = opts;
  const startSec = Math.floor(startInclusive.getTime() / 1000);
  const endSec = Math.floor(endInclusive.getTime() / 1000);
  const { stdout } = await execFileAsync(
    "git",
    ["-C", appRoot, "log", "--format=%H %at", "--reverse", "HEAD"],
    { maxBuffer: 50 * 1024 * 1024 }
  );
  const out = [];
  for (const line of stdout.trim().split("\n")) {
    if (!line) continue;
    const sp = line.indexOf(" ");
    const sha = line.slice(0, sp);
    const at = Number(line.slice(sp + 1));
    if (!sha || !Number.isFinite(at)) continue;
    if (at >= startSec && at <= endSec) {
      out.push({ sha, authorDate: new Date(at * 1000) });
    }
  }
  return out;
}

/**
 * One-line subject per commit + combined stat summary for the range.
 * @param {{ appRoot: string; shas: string[] }} opts
 */
export async function formatGitPayload(opts) {
  const { appRoot, shas } = opts;
  if (shas.length === 0) return "(no commits)";
  const lines = [];
  for (const sha of shas) {
    const { stdout: subj } = await execFileAsync("git", ["-C", appRoot, "log", "-1", "--format=%s", sha]);
    lines.push(`${sha.slice(0, 7)} ${subj.trim()}`);
  }
  const statParts = [];
  for (const sha of shas) {
    try {
      const { stdout } = await execFileAsync("git", [
        "-C",
        appRoot,
        "show",
        "--stat",
        "--format=",
        sha
      ]);
      statParts.push(stdout.trim());
    } catch {
      statParts.push(`${sha.slice(0, 7)} (stat unavailable)`);
    }
  }
  const statBlock = statParts.join("\n\n---\n\n");
  return `Commits (${shas.length}):\n${lines.join("\n")}\n\nPer-commit stats:\n${statBlock}`;
}

/**
 * Runs `fn` with fotonoza-app checked out at `targetSha` (detached), then restores
 * the previous branch or detached HEAD. Used so build + Playwright match the
 * newest commit in the backfill window.
 *
 * @template T
 * @param {{ appRoot: string; targetSha: string; fn: () => Promise<T> }} opts
 * @returns {Promise<T>}
 */
export async function withAppRepoAtCommitForScreenshot(opts) {
  const { appRoot, targetSha, fn } = opts;
  const { stdout: headShaOut } = await execFileAsync("git", ["-C", appRoot, "rev-parse", "HEAD"]);
  const savedHead = headShaOut.trim();
  const { stdout: abbrevOut } = await execFileAsync("git", ["-C", appRoot, "rev-parse", "--abbrev-ref", "HEAD"]);
  const abbrevRef = abbrevOut.trim();

  await execFileAsync("git", ["-C", appRoot, "checkout", "--detach", targetSha]);
  try {
    return await fn();
  } finally {
    try {
      if (abbrevRef !== "HEAD") {
        await execFileAsync("git", ["-C", appRoot, "checkout", abbrevRef]);
      } else {
        await execFileAsync("git", ["-C", appRoot, "checkout", savedHead]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Failed to restore fotonoza-app git state after screenshot (was ${savedHead} / ${abbrevRef}). ` +
          `Check out your branch manually. ${msg}`
      );
    }
  }
}

