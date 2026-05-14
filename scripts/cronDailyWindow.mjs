#!/usr/bin/env node
/**
 * Daily progress window: last 24h through "now" (UTC), same pipeline as backfill.
 * Intended for Vercel Cron (via API route) with `--push`; also runnable locally.
 */
import "dotenv/config";
import { formatYyMmDdHhMmUtc } from "./lib/formatYyMmDdHhMmUtc.mjs";
import { runBackfillRange } from "./lib/backfillCore.mjs";
import { getFotonozaRoot, resolveAppRoot } from "./lib/paths.mjs";

function argvFlags(argv) {
  const out = { commit: false, push: false, noPr: false, appRoot: undefined };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--commit") out.commit = true;
    else if (a === "--push") {
      out.push = true;
      out.commit = true;
    } else if (a === "--no-pr") out.noPr = true;
    else if (a === "--app-root") {
      out.appRoot = argv[++i];
      if (!out.appRoot) throw new Error("--app-root needs a value");
    } else if (a.startsWith("-")) {
      throw new Error(`Unknown flag: ${a}`);
    }
  }
  return out;
}

async function main() {
  const flags = argvFlags(process.argv);
  if (!flags.push) {
    console.error("Usage: node scripts/cronDailyWindow.mjs --push [--no-pr] [--app-root <path>]");
    console.error("  Computes yyMMddHHmm window: (now UTC − 24h) .. (now UTC), then runs the backfill pipeline.");
    process.exit(64);
  }

  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    console.error("Missing CURSOR_API_KEY (set in environment or .env)");
    process.exit(1);
  }

  const endUtc = new Date();
  const startUtc = new Date(endUtc.getTime() - 24 * 60 * 60 * 1000);
  const startToken = formatYyMmDdHhMmUtc(startUtc);
  const endToken = formatYyMmDdHhMmUtc(endUtc);

  console.log(`[cron-daily] UTC window ${startToken} .. ${endToken} (${startUtc.toISOString()} → ${endUtc.toISOString()})`);

  const fotonozaRoot = getFotonozaRoot();
  const appRoot = resolveAppRoot(flags.appRoot);

  try {
    const result = await runBackfillRange({
      startToken,
      endToken,
      apiKey,
      fotonozaRoot,
      appRoot,
      flags
    });
    if (result.outcome === "no_commits") {
      console.log(result.message);
      process.exit(0);
    }
    console.log(`[cron-daily] wrote ${result.slug}`);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
