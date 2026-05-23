/// <reference path="../types.mjs" />
import { git } from "./git.mjs";

const DEFAULT_DIFF_MAX_BYTES = 400_000;

/**
 * Remove trailing git trailers (Signed-off-by, Co-authored-by, etc.) from a stored message.
 * Does not trim user-authored body text.
 * @param {string} raw
 */
function stripGitTrailers(raw) {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  while (lines.length > 0 && lines.at(-1)?.trim() === "") lines.pop();
  while (lines.length > 0 && /^[\w-]+: .+/.test(lines.at(-1) ?? ""))
    lines.pop();
  while (lines.length > 0 && lines.at(-1)?.trim() === "") lines.pop();
  return lines.join("\n");
}

/**
 * Full commit message as stored (subject + body), without trailing trailers.
 * @param {string} appRoot
 * @param {string} sha
 */
async function getFullCommitMessage(appRoot, sha) {
  const raw = await git(appRoot, ["log", "-1", "--format=%B", sha]);
  return stripGitTrailers(raw);
}

/**
 * @param {GitPayloadCtx} ctx
 */
export async function formatGitPayload(ctx) {
  const { appRoot, shas } = ctx;
  if (shas.length === 0) return "(no commits)";

  const messageBlocks = [];
  for (const sha of shas) {
    const message = await getFullCommitMessage(appRoot, sha);
    messageBlocks.push(`### ${sha.slice(0, 7)}\n${message}`);
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
  return `Commits (${shas.length}):\n\n${messageBlocks.join("\n\n")}\n\nPer-commit stats:\n${statBlock}`;
}

/**
 * Combined patch text for all SHAs (oldest-first), truncated to `maxBytes`.
 * @param {string} appRoot
 * @param {string[]} shas
 * @param {{ maxBytes?: number }} [opts]
 */
export async function collectAggregatedDiff(appRoot, shas, opts = {}) {
  const maxBytes = opts.maxBytes ?? DEFAULT_DIFF_MAX_BYTES;
  if (shas.length === 0) return "(no commits)";

  const parts = [];
  let total = 0;
  let truncated = false;

  for (const sha of shas) {
    if (total >= maxBytes) {
      truncated = true;
      break;
    }
    let patch;
    try {
      patch = await git(appRoot, [
        "show",
        "--format=",
        "--patch",
        "--no-ext-diff",
        sha,
      ]);
    } catch {
      continue;
    }
    const header = `\n--- commit ${sha.slice(0, 7)} ---\n`;
    const chunk = header + patch;
    if (total + chunk.length > maxBytes) {
      parts.push(
        chunk.slice(0, Math.max(0, maxBytes - total)) +
          "\n\n[diff truncated]\n",
      );
      truncated = true;
      break;
    }
    parts.push(chunk);
    total += chunk.length;
  }

  const body = parts.join("").trim();
  if (!body) return "(no diff available)";
  if (truncated) {
    return `${body}\n\n(note: aggregated diff was truncated for size)`;
  }
  return body;
}
