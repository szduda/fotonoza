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

/**
 * Format a UTC instant as `yyMMddHHmm` (same contract as {@link parseYyMmDdHhMmUtc}).
 * @param {Date} d
 * @returns {string}
 */
export function formatYyMmDdHhMmUtc(d) {
  const yy = String(d.getUTCFullYear() % 100).padStart(2, "0");
  const MM = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const HH = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yy}${MM}${dd}${HH}${mm}`;
}

/**
 * Full previous UTC calendar day as inclusive author-date window tokens (00:00 … 23:59).
 * @param {number} [daysAgo] default 1 = yesterday
 */
export function utcCalendarDayBoundsAsTokens(daysAgo = 1) {
  const now = new Date();
  const day = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo, 12, 0, 0, 0)
  );
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 23, 59, 0, 0));
  return { startToken: formatYyMmDdHhMmUtc(start), endToken: formatYyMmDdHhMmUtc(end) };
}

/** Previous UTC calendar day at 00:00 (instant). */
export function utcPreviousCalendarDayMidnight() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0, 0));
}

/** Next UTC calendar day after “today” in UTC at 00:00 (i.e. today + 1 day at 00:00). */
export function utcNextCalendarDayMidnight() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
}
