import type { APIRoute } from "astro";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { ensureFotonozaAppForVercel } from "../../../../scripts/lib/ensureFotonozaAppForVercel.mjs";
import { formatYyMmDdHhMmUtc } from "../../../../scripts/lib/formatYyMmDdHhMmUtc.mjs";
import { runBackfillRange } from "../../../../scripts/lib/backfillCore.mjs";
import { getFotonozaRoot, resolveAppRoot } from "../../../../scripts/lib/paths.mjs";

export const prerender = false;

const LOG_SCOPE = "cron:daily-progress";

const execFileAsync = promisify(execFile);

type LogLevel = "info" | "warn" | "error";

/**
 * One JSON line per event so Vercel Runtime Logs stay grep-friendly. Never log secrets.
 */
function cronLog(level: LogLevel, event: string, data?: Record<string, unknown>) {
  const payload = {
    scope: LOG_SCOPE,
    level,
    event,
    ts: new Date().toISOString(),
    ...data
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

/**
 * Vercel Cron does not show the HTTP response body in Runtime Logs — only stdout/stderr.
 * Always log the same payload we return under `event: "http_response"` so you can read it in logs.
 */
function logHttpResponse(
  status: number,
  body: Record<string, unknown> | string,
  logLevel?: LogLevel
) {
  const level =
    logLevel ?? (status >= 500 ? "error" : status >= 400 ? "warn" : ("info" as LogLevel));
  if (typeof body === "string") {
    cronLog(level, "http_response", { status, contentType: "text/plain", bodyText: body });
  } else {
    cronLog(level, "http_response", { status, contentType: "application/json", body });
  }
}

function respondJson(status: number, body: Record<string, unknown>, logLevel?: LogLevel) {
  logHttpResponse(status, body, logLevel);
  return jsonResponse(body, status);
}

function failResponse(status: number, body: Record<string, unknown>, logLevel?: LogLevel) {
  return respondJson(status, body, logLevel);
}

/** Fail fast on Vercel with messages that show up in Runtime Logs and JSON body. */
async function vercelCronPreflight(): Promise<Response | null> {
  if (!process.env.VERCEL) {
    cronLog("info", "preflight_skipped", { reason: "not_vercel" });
    return null;
  }

  cronLog("info", "preflight_vercel_start", {});

  let appRoot: string;
  try {
    appRoot = resolveAppRoot();
    cronLog("info", "preflight_app_root_resolved", {
      appRoot,
      fotonozaRoot: getFotonozaRoot()
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return failResponse(503, { ok: false, code: "APP_ROOT", error: msg }, "error");
  }

  const fotonozaRoot = getFotonozaRoot();
  for (const [label, dir] of [
    ["fotonoza", fotonozaRoot],
    ["fotonoza-app", appRoot]
  ] as const) {
    const gitDir = join(dir, ".git");
    if (!existsSync(gitDir)) {
      return failResponse(
        503,
        {
          ok: false,
          code: "NO_DOT_GIT",
          error: `${label} at ${dir} has no .git directory. Vercel serverless bundles usually omit .git, so git log / checkout / push cannot run. Fix: ship .git for both repos (e.g. adapter includeFiles) or clone into /tmp at the start of this handler with a deploy token.`,
          path: dir
        },
        "error"
      );
    }
    cronLog("info", "preflight_dot_git_ok", { label, dir });
  }

  try {
    const { stdout } = await execFileAsync("git", ["--version"], { timeout: 5000 });
    cronLog("info", "preflight_git_cli_ok", { version: stdout.trim() });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return failResponse(
      503,
      {
        ok: false,
        code: "NO_GIT_CLI",
        error: "The `git` executable is not available or failed `git --version` on this runtime.",
        detail: errMsg
      },
      "error"
    );
  }

  cronLog("info", "preflight_vercel_ok", { fotonozaRoot, appRoot });
  return null;
}

export const GET: APIRoute = async ({ request }) => {
  const vercelId = request.headers.get("x-vercel-id") ?? undefined;
  const cronTime = request.headers.get("x-vercel-cron") ?? undefined;
  cronLog("info", "request_start", {
    method: request.method,
    url: request.url,
    vercelId,
    cronHeader: cronTime,
    region: process.env.VERCEL_REGION,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID
  });

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return failResponse(503, { ok: false, error: "CRON_SECRET is not configured" }, "error");
  }

  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    cronLog("warn", "auth_failed", {
      vercelId,
      hasAuthHeader: Boolean(auth),
      scheme: auth ? auth.split(" ", 1)[0] : null
    });
    logHttpResponse(401, "Unauthorized", "warn");
    return new Response("Unauthorized", { status: 401 });
  }
  cronLog("info", "auth_ok", { vercelId });

  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    return failResponse(503, { ok: false, error: "CURSOR_API_KEY is not configured" }, "error");
  }
  cronLog("info", "config_ok", { hasCursorApiKey: true, vercelId });

  if (process.env.VERCEL) {
    try {
      await ensureFotonozaAppForVercel();
      cronLog("info", "ensure_fotonoza_app_ok", { vercelId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      cronLog("error", "ensure_fotonoza_app_failed", { error: msg, vercelId });
      return failResponse(
        503,
        {
          ok: false,
          code: "MISSING_FOTONOZA_APP_CONFIG",
          error: msg
        },
        "error"
      );
    }
  }

  const preflight = await vercelCronPreflight();
  if (preflight) return preflight;

  const endUtc = new Date();
  const startUtc = new Date(endUtc.getTime() - 24 * 60 * 60 * 1000);
  const startToken = formatYyMmDdHhMmUtc(startUtc);
  const endToken = formatYyMmDdHhMmUtc(endUtc);

  cronLog("info", "window_computed", {
    startToken,
    endToken,
    startIso: startUtc.toISOString(),
    endIso: endUtc.toISOString()
  });

  const flags = {
    commit: true,
    push: true,
    noPr: process.env.CRON_NO_PR === "1"
  };

  const fotonozaRoot = getFotonozaRoot();
  let appRoot: string;
  try {
    appRoot = resolveAppRoot();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    cronLog("error", "resolve_app_root_failed", { error: msg, vercelId });
    return failResponse(503, { ok: false, code: "APP_ROOT", error: msg }, "error");
  }

  cronLog("info", "pipeline_start", {
    fotonozaRoot,
    appRoot,
    flags,
    vercelId
  });

  const t0 = Date.now();
  try {
    const result = await runBackfillRange({
      startToken,
      endToken,
      apiKey,
      fotonozaRoot,
      appRoot,
      flags
    });
    const ms = Date.now() - t0;

    if (result.outcome === "no_commits") {
      cronLog("info", "pipeline_done_no_commits", { ms, vercelId });
      return respondJson(200, {
        ok: true,
        outcome: "no_commits",
        message: result.message,
        window: { startToken, endToken }
      });
    }

    cronLog("info", "pipeline_done_posted", { ms, slug: result.slug, vercelId });
    return respondJson(200, {
      ok: true,
      outcome: "posted",
      slug: result.slug,
      window: { startToken, endToken }
    });
  } catch (e) {
    const ms = Date.now() - t0;
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    const name = e instanceof Error ? e.name : typeof e;

    cronLog("error", "pipeline_throw", {
      ms,
      vercelId,
      errorName: name,
      errorMessage: msg
    });
    if (stack) {
      cronLog("error", "pipeline_throw_stack", { vercelId, stack });
    }

    const code =
      /Could not find fotonoza-app|FOTONOZA_APP_ROOT|not a git repository|ENOENT.*\bgit\b/i.test(msg)
        ? "CONFIG_OR_GIT"
        : "PIPELINE";

    const status = code === "CONFIG_OR_GIT" ? 503 : 500;
    const errBody = { ok: false as const, code, error: msg };
    return respondJson(status, errBody, "error");
  }
};
