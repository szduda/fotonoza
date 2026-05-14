import type { APIRoute } from "astro";
import { formatYyMmDdHhMmUtc } from "../../../../scripts/lib/formatYyMmDdHhMmUtc.mjs";
import { runBackfillRange } from "../../../../scripts/lib/backfillCore.mjs";
import { getFotonozaRoot, resolveAppRoot } from "../../../../scripts/lib/paths.mjs";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response("CRON_SECRET is not configured", { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    return new Response("CURSOR_API_KEY is not configured", { status: 503 });
  }

  const endUtc = new Date();
  const startUtc = new Date(endUtc.getTime() - 24 * 60 * 60 * 1000);
  const startToken = formatYyMmDdHhMmUtc(startUtc);
  const endToken = formatYyMmDdHhMmUtc(endUtc);

  const flags = {
    commit: true,
    push: true,
    noPr: process.env.CRON_NO_PR === "1"
  };

  try {
    const result = await runBackfillRange({
      startToken,
      endToken,
      apiKey,
      fotonozaRoot: getFotonozaRoot(),
      appRoot: resolveAppRoot(),
      flags
    });

    if (result.outcome === "no_commits") {
      return new Response(
        JSON.stringify({
          ok: true,
          outcome: "no_commits",
          message: result.message,
          window: { startToken, endToken }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        outcome: "posted",
        slug: result.slug,
        window: { startToken, endToken }
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
};
