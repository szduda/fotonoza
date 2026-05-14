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
 * On Vercel: clone `fotonoza-app` from `FOTONOZA_APP_GIT_URL` into `/tmp` and set
 * `process.env.FOTONOZA_APP_ROOT` for this invocation (HTTPS URL with embedded token for private repos).
 *
 * No-op when `VERCEL` is unset (local `resolveAppRoot` / sibling checkout unchanged).
 */
export async function ensureFotonozaAppForVercel() {
  if (!process.env.VERCEL) return;

  const gitUrl = process.env.FOTONOZA_APP_GIT_URL?.trim();
  checkoutLog("info", "env_probe", {
    vercelEnv: process.env.VERCEL_ENV ?? null,
    hasFOTONOZA_APP_GIT_URL: Boolean(gitUrl)
  });

  if (!gitUrl) {
    throw new Error(
      `Set FOTONOZA_APP_GIT_URL for Production (Vercel project → Environment Variables), then redeploy. ` +
        `Cron runs on production; value must be an HTTPS clone URL (include auth for private repos). ` +
        `(VERCEL_ENV=${process.env.VERCEL_ENV ?? "unknown"})`
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
