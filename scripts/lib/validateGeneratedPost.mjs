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
  "bodyPl"
]);

/** @param {unknown} data */
export function assertGeneratedPost(data) {
  if (!isPlainObject(data)) throw new Error("Generated JSON must be an object");
  for (const k of Object.keys(data)) {
    if (!ALLOWED_KEYS.has(k)) {
      throw new Error(`Unexpected JSON key "${k}" (allowed: ${[...ALLOWED_KEYS].join(", ")})`);
    }
  }
  const { title, description, pubDate, body, coverWord, titlePl, descriptionPl, bodyPl } = data;
  for (const [k, v] of [
    ["title", title],
    ["description", description],
    ["body", body],
    ["titlePl", titlePl],
    ["descriptionPl", descriptionPl],
    ["bodyPl", bodyPl]
  ]) {
    if (typeof v !== "string" || !v.trim()) {
      throw new Error(`Field "${k}" must be a non-empty string`);
    }
  }
  if (typeof pubDate !== "string" || !pubDate.trim()) {
    throw new Error('Field "pubDate" must be an ISO-8601 date string');
  }
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid pubDate: ${pubDate}`);
  }
  if (typeof coverWord !== "string") {
    throw new Error('Field "coverWord" must be a string');
  }
  const cw = coverWord.trim();
  if (!/^[a-z]{2,32}$/.test(cw)) {
    throw new Error('Field "coverWord" must be one ASCII word: 2–32 lowercase letters a–z only (no spaces or digits)');
  }
}
