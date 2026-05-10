/**
 * Pull a single JSON object from model output (raw JSON or ```json fence).
 * @param {string} text
 * @returns {unknown}
 */
export function extractJsonFromModelText(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Empty model output");
  }
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    return JSON.parse(fence[1].trim());
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(text.slice(start, end + 1));
  }
  throw new Error("No JSON object found in model output");
}
