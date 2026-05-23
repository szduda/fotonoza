import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * @param {string} cwd
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Promise<string>}
 */
export async function gh(cwd, args, env = process.env) {
  const { stdout } = await execFileAsync("gh", args, {
    cwd,
    env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

/** @returns {Promise<boolean>} whether an open PR already exists for `branch` */
export async function prExists(cwd, branch) {
  const listed = await gh(cwd, [
    "pr",
    "list",
    "--head",
    branch,
    "--state",
    "open",
    "--json",
    "number",
  ]);
  return JSON.parse(listed || "[]").length > 0;
}

export async function createPr(cwd, branch, { base, body, title }) {
  return gh(cwd, [
    "pr",
    "create",
    "--base",
    base,
    "--head",
    branch,
    "--title",
    title,
    "--body",
    body,
  ]);
}

export function ghErrorDetail(e) {
  const msg = e instanceof Error ? e.message : String(e);
  const stderr =
    e && typeof e === "object" && "stderr" in e
      ? String(/** @type {{ stderr?: unknown }} */ (e).stderr)
      : "";
  return [msg, stderr].filter(Boolean).join("\n");
}

export function isPrExistsError(detail) {
  if (
    !/already exists|pull request already exists|A pull request already/i.test(
      detail,
    )
  ) {
    return false;
  }
  console.log("[git] gh pr create skipped (PR already exists):", detail);
  return true;
}

export function handlePrError(detail) {
  if (process.env.GITHUB_ACTIONS === "true") {
    console.error("[git] gh pr create failed in Actions:\n", detail);
    const hint = /not permitted to create or approve pull requests/i.test(
      detail,
    )
      ? ' Enable: repo Settings → Actions → General → Workflow permissions → "Read and write permissions" and check "Allow GitHub Actions to create and approve pull requests".'
      : "";
    throw new Error(`gh pr create failed: ${detail}${hint}`);
  }

  console.warn("[git] gh pr create failed (install gh and auth):", detail);
}
