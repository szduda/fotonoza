/**
 * Format a `Date` as `yyMMddHHmm` in **UTC** (inverse of {@link parseYyMmDdHhMmUtc}).
 * @param {Date} d
 * @returns {string}
 */
export function formatYyMmDdHhMmUtc(d) {
  const yy = String(d.getUTCFullYear() % 100).padStart(2, "0");
  const MM = String(d.getUTCMonth() + 1).padStart(2, "0");
  const DD = String(d.getUTCDate()).padStart(2, "0");
  const HH = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yy}${MM}${DD}${HH}${mm}`;
}
