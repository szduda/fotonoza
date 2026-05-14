import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Stable path under /tmp so warm invocations can `git fetch` instead of full clone. */
const CLONE_DIR = "/tmp/fotonoza-app-cron";

const GIT_URL_ENV_KEYS = ["FOTONOZA_APP_GIT_URL", "FOTONOZA_APP_REPO_URL", "FOTONOZA_APP_CLONE_URL"];

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

/** First non-empty trimmed value among env keys. */
function firstEnv(...keys) {
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v) return { key: k, value: v };
  }
  return null;
}

/**
 * Resolve clone URL from explicit URL env(s) or `FOTONOZA_APP_GITHUB_REPO` + token.
 * Never logs token or full URL with credentials.
 * @returns {string | ""}
 */
function resolveCloneGitUrl() {
  const explicit = firstEnv(...GIT_URL_ENV_KEYS);
  if (explicit) return explicit.value;

  const repo = process.env.FOTONOZA_APP_GITHUB_REPO?.trim();
  if (!repo) return "";

  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error(
      `FOTONOZA_APP_GITHUB_REPO must look like "org/repo" (got malformed value).`
    );
  }

  const token =
    process.env.FOTONOZA_APP_GITHUB_TOKEN?.trim() ||
    process.env.GITHUB_TOKEN?.trim() ||
    process.env.GH_TOKEN?.trim() ||
    "";

  if (!token) {
    throw new Error(
      "FOTONOZA_APP_GITHUB_REPO is set but no token found. Set FOTONOZA_APP_GITHUB_TOKEN " +
        "(recommended, scoped to fotonoza-app) or GITHUB_TOKEN / GH_TOKEN with repo read access."
    );
  }

  return `https://x-access-token:${token}@github.com/${repo}.git`;
}

/**
 * On Vercel, either use `FOTONOZA_APP_ROOT` or clone from a git URL into `/tmp`
 * and set `process.env.FOTONOZA_APP_ROOT` for this invocation.
 *
 * Supported env (Production + Cron must see the same vars):
 * - `FOTONOZA_APP_ROOT` — absolute path with `package.json` + `.git`
 * - `FOTONOZA_APP_GIT_URL` — full HTTPS clone URL (token in URL), or aliases `FOTONOZA_APP_REPO_URL`, `FOTONOZA_APP_CLONE_URL`
 * - `FOTONOZA_APP_GITHUB_REPO` = `org/repo` plus `FOTONOZA_APP_GITHUB_TOKEN` or `GITHUB_TOKEN` / `GH_TOKEN`
 *
 * No-op when not on Vercel.
 */
export async function ensureFotonozaAppForVercel() {
  if (!process.env.VERCEL) return;

  const rootRaw = process.env.FOTONOZA_APP_ROOT?.trim();
  const rootHasPkg = Boolean(rootRaw && existsSync(join(rootRaw, "package.json")));

  const explicitUrlEntry = firstEnv(...GIT_URL_ENV_KEYS);
  const hasGithubRepo = Boolean(process.env.FOTONOZA_APP_GITHUB_REPO?.trim());
  const hasDedicatedPat = Boolean(process.env.FOTONOZA_APP_GITHUB_TOKEN?.trim());
  const hasGithubToken = Boolean(process.env.GITHUB_TOKEN?.trim());
  const hasGhToken = Boolean(process.env.GH_TOKEN?.trim());

  checkoutLog("info", "env_probe", {
    hasFOTONOZA_APP_ROOT: Boolean(rootRaw),
    fotonozaAppRootHasPackageJson: rootHasPkg,
    explicitGitUrlEnvKey: explicitUrlEntry?.key ?? null,
    hasFOTONOZA_APP_GITHUB_REPO: hasGithubRepo,
    hasFOTONOZA_APP_GITHUB_TOKEN: hasDedicatedPat,
    hasGITHUB_TOKEN: hasGithubToken,
    hasGH_TOKEN: hasGhToken
  });

  if (rootRaw && rootHasPkg) {
    checkoutLog("info", "using_fotonoza_app_root", { path: rootRaw });
    return;
  }

  if (rootRaw && !rootHasPkg) {
    throw new Error(
      `FOTONOZA_APP_ROOT is set to "${rootRaw}" but package.json is missing on this instance ` +
        `(wrong path for serverless, or typo). Unset it and use a clone URL / GitHub repo + token instead.`
    );
  }

  let gitUrl;
  try {
    gitUrl = resolveCloneGitUrl();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    checkoutLog("error", "resolve_clone_url_failed", { error: msg });
    throw e;
  }

  if (!gitUrl) {
    throw new Error(
      "Configure fotonoza-app for this cron (Vercel → Settings → Environment Variables → Production). " +
        "Use one of: (1) FOTONOZA_APP_ROOT = absolute path to a checkout with .git, " +
        "(2) FOTONOZA_APP_GIT_URL (or FOTONOZA_APP_REPO_URL / FOTONOZA_APP_CLONE_URL) = full HTTPS clone URL with token, " +
        "(3) FOTONOZA_APP_GITHUB_REPO = org/repo plus FOTONOZA_APP_GITHUB_TOKEN or GITHUB_TOKEN / GH_TOKEN."
    );
  }

  if (explicitUrlEntry) {
    checkoutLog("info", "clone_url_source", { source: explicitUrlEntry.key });
  } else {
    checkoutLog("info", "clone_url_source", { source: "composed_github", repo: process.env.FOTONOZA_APP_GITHUB_REPO?.trim() });
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
