/// <reference path="../types.mjs" />
import { createHash } from "node:crypto";

function commitSetFingerprint(shas) {
  const body = [...shas].sort().join("\n");
  return createHash("sha256").update(body).digest("hex").slice(0, 8);
}

/** @param {SlugInput} p */
export function makeSlug(p) {
  const fp = commitSetFingerprint(p.shas);
  return `progress-${p.end}-${fp}`;
}

/**
 * Filename for \`/progress/\` hero image: one ASCII word + 5 hex chars from commit set hash.
 * @param {string} coverWord single word from the model (letters a–z)
 * @param {string[]} shas
 * @returns {string} e.g. `timeline-a1b2c.png`
 */
export function makeImageFileName(coverWord, shas) {
  const fp = commitSetFingerprint(shas);
  const raw = String(coverWord || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const word = (raw.length >= 2 ? raw : "post").slice(0, 32);
  return `${word}-${fp.slice(0, 5)}.png`;
}
