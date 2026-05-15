import { createHash } from "node:crypto";

export function commitSetFingerprint(shas) {
  const body = [...shas].sort().join("\n");
  return createHash("sha256").update(body).digest("hex").slice(0, 8);
}

/**
 * @param {{ rangeStartToken: string; rangeEndToken: string; shas: string[] }} p
 */
export function makeProgressSlug(p) {
  const fp = commitSetFingerprint(p.shas);
  return `progress-${p.rangeStartToken}-${p.rangeEndToken}-${fp}`;
}

/**
 * Filename for \`/progress/\` hero image: one ASCII word + 5 hex chars from commit set hash.
 * @param {string} coverWord single word from the model (letters a–z)
 * @param {string[]} shas
 * @returns {string} e.g. `timeline-a1b2c.png`
 */
export function makeCoverImageFileName(coverWord, shas) {
  const fp = commitSetFingerprint(shas);
  const h5 = fp.slice(0, 5);
  const raw = String(coverWord || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const word = (raw.length >= 2 ? raw : "post").slice(0, 32);
  return `${word}-${h5}.png`;
}
