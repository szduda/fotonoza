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
