/** @param {string} str @param {number} quoteIdx */
function isEscapedQuote(str, quoteIdx) {
  let backslashes = 0;
  for (let j = quoteIdx - 1; j >= 0 && str[j] === "\\"; j--) {
    backslashes++;
  }
  return backslashes % 2 === 1;
}

/**
 * First `{…}` segment with balanced braces; ignores `{` `}` inside JSON strings.
 * Stops at the first closing `}` that ends the root object so trailing model text
 * after valid JSON is not included.
 * @param {string} text
 * @returns {string | null}
 */
function sliceFirstJsonObject(text) {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];

    if (inString) {
      if (c === '"' && !isEscapedQuote(text, i)) {
        inString = false;
      }
      continue;
    }

    if (c === '"') {
      inString = true;
      continue;
    }

    if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

/**
 * Pull a single JSON object from model output (```json fence or first object in text).
 * @param {string} text
 * @returns {unknown}
 */
export function extractJsonFromModelText(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Empty model output");
  }

  let candidate = text.trim();
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    candidate = fence[1].trim();
  }

  const sliced = sliceFirstJsonObject(candidate) ?? sliceFirstJsonObject(text);
  if (!sliced) {
    throw new Error("No JSON object found in model output");
  }

  try {
    return JSON.parse(sliced);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `${msg}\n--- JSON head ---\n${sliced.slice(0, 400)}\n--- JSON tail ---\n${sliced.slice(-400)}`,
    );
  }
}
