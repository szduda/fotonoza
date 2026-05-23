/// <reference path="../types.mjs" />
import { git } from "./git.mjs";

/**
 * List commits in `appRoot` whose **author date** lies in `[startDate, endDate]` on HEAD, oldest first.
 * @param {ListCommitsCtx} ctx
 */
export async function getCommitsInRange(ctx) {
  const startSec = Math.floor(ctx.startDate.getTime() / 1000);
  const endSec = Math.floor(ctx.endDate.getTime() / 1000);
  const stdout = await git(
    ctx.appRoot,
    ["log", "--format=%H %at", "--reverse", "HEAD"],
    { maxBuffer: 50 * 1024 * 1024 },
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
