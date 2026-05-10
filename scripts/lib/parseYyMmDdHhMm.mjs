/**
 * Parse `yyMMddHHmm` as an instant in **UTC** (per backfill contract).
 * @param {string} token 10-digit string
 * @returns {Date}
 */
export function parseYyMmDdHhMmUtc(token) {
  if (typeof token !== "string" || !/^\d{10}$/.test(token)) {
    throw new Error(`Expected yyMMddHHmm (10 digits), got: ${JSON.stringify(token)}`);
  }
  const yy = Number(token.slice(0, 2));
  const year = 2000 + yy;
  const month = Number(token.slice(2, 4)) - 1;
  const day = Number(token.slice(4, 6));
  const hour = Number(token.slice(6, 8));
  const minute = Number(token.slice(8, 10));
  const ms = Date.UTC(year, month, day, hour, minute, 0, 0);
  const d = new Date(ms);
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month ||
    d.getUTCDate() !== day ||
    d.getUTCHours() !== hour ||
    d.getUTCMinutes() !== minute
  ) {
    throw new Error(`Invalid calendar values in token: ${token}`);
  }
  return d;
}
