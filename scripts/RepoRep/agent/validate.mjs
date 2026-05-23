/**
 * @param {string} text
 * @returns {string}
 */
export function parseDiffSummaryText(text) {
  const summary = String(text ?? "").trim();
  if (!summary) {
    throw new Error("Diff summary response was empty");
  }
  const words = summary.split(/\s+/).filter(Boolean);
  if (words.length < 20) {
    throw new Error(
      `Diff summary too short (${words.length} words); expected about 50–200 words`,
    );
  }
  if (words.length > 280) {
    throw new Error(
      `Diff summary too long (${words.length} words); expected about 50–200 words`,
    );
  }
  return summary;
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const ALLOWED_KEYS = new Set([
  "title",
  "description",
  "pubDate",
  "body",
  "coverWord",
  "titlePl",
  "descriptionPl",
  "bodyPl",
]);

/** @param {unknown} data */
export function assertGeneratedPost(data) {
  if (!isPlainObject(data)) {
    throw new Error("Generated JSON must be an object");
  }

  for (const k of Object.keys(data)) {
    if (!ALLOWED_KEYS.has(k)) {
      throw new Error(
        `Unexpected JSON key "${k}" (allowed: ${[...ALLOWED_KEYS].join(", ")})`,
      );
    }
  }

  if (Object.keys(data).length !== ALLOWED_KEYS.size) {
    const missing = [...ALLOWED_KEYS].filter((k) => !(k in data));
    throw new Error(`Missing JSON keys: ${missing.join(", ")}`);
  }

  for (const [k, v] of Object.entries(data)) {
    if (k === "coverWord") {
      if (typeof v !== "string") {
        throw new Error('Field "coverWord" must be a string');
      }

      if (!/^[a-z]{2,32}$/.test(v.trim())) {
        throw new Error(
          'Field "coverWord" must be one ASCII word: 2–32 lowercase letters a–z only (no spaces or digits)',
        );
      }
      continue;
    }

    if (k === "pubDate") {
      if (typeof v !== "string" || !v.trim()) {
        throw new Error('Field "pubDate" must be an ISO-8601 date string');
      }
      if (Number.isNaN(new Date(v).getTime())) {
        throw new Error(`Invalid pubDate: ${v}`);
      }
      continue;
    }

    if (typeof v !== "string" || !v.trim()) {
      throw new Error(`Field "${k}" must be a non-empty string`);
    }
  }
}
