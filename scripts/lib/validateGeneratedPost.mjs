const STEP_TYPES = new Set([
  "goto",
  "waitForSelector",
  "waitForLoadState",
  "waitForTimeout",
  "setViewport",
  "screenshot"
]);

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function validateStep(step) {
  if (!isPlainObject(step) || typeof step.type !== "string") return false;
  if (!STEP_TYPES.has(step.type)) return false;
  switch (step.type) {
    case "goto":
      return typeof step.path === "string" && step.path.startsWith("/");
    case "waitForSelector": {
      if (typeof step.selector !== "string" || step.selector.length === 0) return false;
      if (step.timeoutMs !== undefined) {
        if (typeof step.timeoutMs !== "number" || step.timeoutMs < 1000 || step.timeoutMs > 120_000) {
          return false;
        }
      }
      return true;
    }
    case "waitForLoadState":
      return (
        step.state === "load" ||
        step.state === "domcontentloaded" ||
        step.state === "networkidle"
      );
    case "waitForTimeout":
      return typeof step.ms === "number" && step.ms >= 0 && step.ms <= 120_000;
    case "setViewport":
      return (
        typeof step.width === "number" &&
        typeof step.height === "number" &&
        step.width > 0 &&
        step.width <= 4096 &&
        step.height > 0 &&
        step.height <= 4096
      );
    case "screenshot":
      return step.fullPage === undefined || typeof step.fullPage === "boolean";
    default:
      return false;
  }
}

/** @param {unknown} data */
export function assertGeneratedPost(data) {
  if (!isPlainObject(data)) throw new Error("Generated JSON must be an object");
  const { title, description, pubDate, body, screenshotPlan } = data;
  for (const [k, v] of [
    ["title", title],
    ["description", description],
    ["body", body]
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
  if (!isPlainObject(screenshotPlan) || !Array.isArray(screenshotPlan.steps)) {
    throw new Error('Field "screenshotPlan.steps" must be an array');
  }
  if (screenshotPlan.steps.length === 0) {
    throw new Error("screenshotPlan.steps must be non-empty");
  }
  for (const s of screenshotPlan.steps) {
    if (!validateStep(s)) {
      throw new Error(`Invalid screenshot step: ${JSON.stringify(s)}`);
    }
  }
  const last = screenshotPlan.steps[screenshotPlan.steps.length - 1];
  if (last.type !== "screenshot") {
    throw new Error('Last screenshotPlan step must be type "screenshot"');
  }
}
