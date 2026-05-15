import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * @param {string} appRoot
 * @param {string[]} args
 * @param {{ maxBuffer?: number }} [extra]
 */
async function git(appRoot, args, extra = {}) {
  const { stdout } = await execFileAsync("git", ["-C", appRoot, ...args], {
    encoding: "utf8",
    maxBuffer: extra.maxBuffer ?? 50 * 1024 * 1024
  });
  return stdout;
}

/**
 * List commits in `appRoot` whose **author date** (Unix seconds) lies in
 * `[startInclusive, endInclusive]` on the current HEAD history, oldest first.
 * @param {{ appRoot: string; startInclusive: Date; endInclusive: Date }} opts
 */
export async function listCommitsByAuthorDateInRange(opts) {
  const { appRoot, startInclusive, endInclusive } = opts;
  const startSec = Math.floor(startInclusive.getTime() / 1000);
  const endSec = Math.floor(endInclusive.getTime() / 1000);
  const stdout = await git(appRoot, ["log", "--format=%H %at", "--reverse", "HEAD"], {
    maxBuffer: 50 * 1024 * 1024
  });
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
    const subj = await git(appRoot, ["log", "-1", "--format=%s", sha]);
    lines.push(`${sha.slice(0, 7)} ${subj.trim()}`);
  }
  const statParts = [];
  for (const sha of shas) {
    try {
      const block = await git(appRoot, ["show", "--stat", "--format=", sha]);
      statParts.push(block.trim());
    } catch {
      statParts.push(`${sha.slice(0, 7)} (stat unavailable)`);
    }
  }
  const statBlock = statParts.join("\n\n---\n\n");
  return `Commits (${shas.length}):\n${lines.join("\n")}\n\nPer-commit stats:\n${statBlock}`;
}
