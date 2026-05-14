import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Stable path under /tmp so warm invocations can `git fetch` instead of full clone. */
const CLONE_DIR = "/tmp/fotonoza-app-cron";

function checkoutLog(level, event, data = {}) {
  const line = JSON.stringify({
    scope: "cron:fotonoza-app-checkout",
    level,
    event,
    ts: new Date().toISOString(),
    ...data
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/**
 * On Vercel, either use `FOTONOZA_APP_ROOT` or clone from `FOTONOZA_APP_GIT_URL` into `/tmp`
 * and set `process.env.FOTONOZA_APP_ROOT` for this invocation.
 *
 * Use an HTTPS URL with an embedded token, e.g.
 * `https://x-access-token:${GITHUB_TOKEN}@github.com/org/fotonoza-app.git`
 * (set in Vercel env — never log this variable).
 *
 * No-op when not on Vercel.
 */
export async function ensureFotonozaAppForVercel() {
  if (!process.env.VERCEL) return;

  const existing = process.env.FOTONOZA_APP_ROOT?.trim();
  if (existing && existsSync(join(existing, "package.json"))) {
    checkoutLog("info", "using_fotonoza_app_root", { path: existing });
    return;
  }

  const gitUrl = process.env.FOTONOZA_APP_GIT_URL?.trim();
  if (!gitUrl) {
    throw new Error(
      "Set FOTONOZA_APP_ROOT (absolute path to fotonoza-app with .git) or FOTONOZA_APP_GIT_URL " +
        "(HTTPS clone URL with token) in Vercel project env. Serverless has no ../fotonoza-app sibling."
    );
  }

  await mkdir("/tmp", { recursive: true });

  if (existsSync(join(CLONE_DIR, ".git"))) {
    try {
      checkoutLog("info", "git_fetch_start", { path: CLONE_DIR });
      await execFileAsync("git", ["-C", CLONE_DIR, "fetch", "--prune", "origin"], {
        timeout: 120_000,
        maxBuffer: 20 * 1024 * 1024
      });
      await execFileAsync("git", ["-C", CLONE_DIR, "reset", "--hard", "origin/HEAD"], {
        timeout: 60_000,
        maxBuffer: 10 * 1024 * 1024
      });
      process.env.FOTONOZA_APP_ROOT = CLONE_DIR;
      checkoutLog("info", "git_fetch_ok", { path: CLONE_DIR });
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      checkoutLog("warn", "git_fetch_failed_reclone", { error: msg });
      await rm(CLONE_DIR, { recursive: true, force: true });
    }
  }

  checkoutLog("info", "git_clone_start", { target: CLONE_DIR, depth: 200 });
  await execFileAsync(
    "git",
    ["clone", "--depth", "200", "--single-branch", gitUrl, CLONE_DIR],
    { timeout: 300_000, maxBuffer: 30 * 1024 * 1024 }
  );

  process.env.FOTONOZA_APP_ROOT = CLONE_DIR;
  checkoutLog("info", "git_clone_ok", { path: CLONE_DIR });
}
