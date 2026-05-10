import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { sanitizedProcessEnv } from "./sanitizeEnv.mjs";

/**
 * @param {string} url
 * @param {number} timeoutMs
 */
async function waitForOk(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = /** @type {string} */ ("");
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (res.ok) return;
      lastErr = `HTTP ${res.status}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Preview did not become ready at ${url}: ${lastErr}`);
}

/**
 * @param {{ appRoot: string; previewOrigin: string; steps: object[]; outPngPath: string }} opts
 */
function previewPortFromOrigin(previewOrigin) {
  const u = new URL(previewOrigin);
  if (u.port) return u.port;
  if (u.protocol === "http:") return "80";
  if (u.protocol === "https:") return "443";
  return "4173";
}

export async function runScreenshotPlan(opts) {
  const { appRoot, previewOrigin, steps, outPngPath } = opts;
  const port = previewPortFromOrigin(previewOrigin);
  const host = new URL(previewOrigin).hostname || "127.0.0.1";
  const env = sanitizedProcessEnv();
  // Use "ignore" for stdio so pipes never fill (which would block vite) and no
  // pipe handles keep the Node process alive after the child exits.
  const proc = spawn(
    "npm",
    ["run", "preview", "--", "--host", host, "--port", port, "--strictPort"],
    {
      cwd: appRoot,
      env,
      stdio: "ignore"
    }
  );

  try {
    await waitForOk(`${previewOrigin.replace(/\/$/, "")}/`, 120_000);
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ baseURL: previewOrigin });
      const page = await context.newPage();
      for (const step of steps) {
        switch (step.type) {
          case "setViewport":
            await page.setViewportSize({ width: step.width, height: step.height });
            break;
          case "goto":
            await page.goto(step.path, { waitUntil: "domcontentloaded" });
            break;
          case "waitForLoadState":
            await page.waitForLoadState(step.state);
            break;
          case "waitForSelector":
            await page.waitForSelector(step.selector, {
              timeout: step.timeoutMs ?? 30_000
            });
            break;
          case "waitForTimeout":
            await new Promise((r) => setTimeout(r, step.ms));
            break;
          case "screenshot":
            await page.screenshot({
              path: outPngPath,
              fullPage: step.fullPage === true
            });
            break;
          default:
            throw new Error(`Unsupported step: ${step.type}`);
        }
      }
      await context.close();
    } finally {
      await browser.close();
    }
  } finally {
    try {
      proc.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 500));
    if (proc.exitCode === null) {
      try {
        proc.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }
  }
}
