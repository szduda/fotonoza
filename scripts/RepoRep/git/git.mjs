import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * @param {string} root
 * @param {string[]} args
 * @param {{ maxBuffer?: number }} [opts]
 * @returns {Promise<string>}
 */
export async function git(root, args, opts = {}) {
  const { stdout } = await execFileAsync("git", ["-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: opts.maxBuffer ?? 50 * 1024 * 1024,
  });
  return stdout;
}

/** @returns {Promise<0|1>} 0 = empty index, 1 = staged changes */
export async function gitHasChanges(root) {
  try {
    await execFileAsync("git", ["-C", root, "diff", "--cached", "--quiet"], {
      maxBuffer: 10 * 1024 * 1024,
    });
    return 0;
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e
        ? /** @type {{ code?: number }} */ (e).code
        : undefined;
    if (code === 1) return 1;
    throw e;
  }
}

/** @param {string} root @param {string} branch */
export async function gitRemoteHasBranch(root, branch) {
  try {
    return Boolean(
      (await git(root, ["ls-remote", "--heads", "origin", branch], {
        maxBuffer: 1024 * 1024,
      })).trim(),
    );
  } catch {
    return false;
  }
}
