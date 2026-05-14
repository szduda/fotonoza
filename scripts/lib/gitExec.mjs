import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { GitProcess } = require("dugite");

/**
 * Embedded Git via dugite (same as GitHub Desktop). Vercel Node runtimes often
 * lack a system `git` binary; `GitProcess.exec` sets PATH / GIT_EXEC_PATH for the bundled copy.
 *
 * @param {string} cwd Git working directory (same as `git -C <cwd>` for repo commands).
 * @param {string[]} args Git argv **without** leading `git`.
 * @param {{ maxBuffer?: number }} [opts]
 * @returns {Promise<{ stdout: string; stderr: string; exitCode: number }>}
 */
export async function gitExecRaw(cwd, args, opts = {}) {
  const maxBuffer = opts.maxBuffer ?? 50 * 1024 * 1024;
  const r = await GitProcess.exec(args, cwd, { maxBuffer });
  return {
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    exitCode: r.exitCode ?? 0
  };
}

/**
 * Like {@link gitExecRaw}, but throws unless exit code is 0.
 * @param {string} cwd
 * @param {string[]} args
 * @param {{ maxBuffer?: number }} [opts]
 */
export async function gitExec(cwd, args, opts = {}) {
  const r = await gitExecRaw(cwd, args, opts);
  if (r.exitCode !== 0) {
    const err = new Error((r.stderr || "").trim() || `git exited with code ${r.exitCode}`);
    /** @type {Error & { code?: number }} */ (err).code = r.exitCode;
    throw err;
  }
  return { stdout: r.stdout, stderr: r.stderr };
}
