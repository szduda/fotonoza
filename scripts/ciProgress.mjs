#!/usr/bin/env node
/**
 * CI / scheduled entry: plan from fotonoza-app git → log payload → Cursor → write markdown → commit/push/PR.
 * Local fallback remains `npm run backfill`.
 */
import "dotenv/config";
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { maybeGitCommitPushPr } from "./lib/backfillCore.mjs";
import {
  formatYyMmDdHhMmUtc,
  parseYyMmDdHhMmUtc,
  utcCalendarDayBoundsAsTokens,
  utcNextCalendarDayMidnight,
  utcPreviousCalendarDayMidnight
} from "./lib/parseYyMmDdHhMm.mjs";
import { getFotonozaRoot, resolveAppRoot } from "./lib/paths.mjs";
import { planProgressRange, runProgressPipelineFromPlan } from "./lib/runProgressPipeline.mjs";

function printUsage() {
  console.error(`Usage:
  npm run progress:ci -- <yyMMddHHmm> <yyMMddHHmm>   UTC inclusive author-date window
  npm run progress:ci -- --yesterday-utc             previous full UTC calendar day (00:00–23:59)

Omit either token (pass "" "") to apply defaults (UTC):
  start empty → previous calendar day at 00:00
  end empty   → (today + 1 calendar day) at 00:00

Environment:
  CURSOR_API_KEY     Required
  FOTONOZA_APP_ROOT  Required in CI (path to fotonoza-app checkout)
`);
}

/**
 * @param {string} rawStart
 * @param {string} rawEnd
 */
function resolveDispatchRangeTokens(rawStart, rawEnd) {
  const s = typeof rawStart === "string" ? rawStart.trim() : "";
  const e = typeof rawEnd === "string" ? rawEnd.trim() : "";
  const startToken = s || formatYyMmDdHhMmUtc(utcPreviousCalendarDayMidnight());
  const endToken = e || formatYyMmDdHhMmUtc(utcNextCalendarDayMidnight());
  for (const [label, t] of [
    ["start", startToken],
    ["end", endToken]
  ]) {
    if (!/^\d{10}$/.test(t)) {
      throw new Error(`${label}: expected yyMMddHHmm (10 digits) or leave empty for default, got ${JSON.stringify(t)}`);
    }
  }
  return { startToken, endToken };
}

function appendStepSummary(text) {
  const p = process.env.GITHUB_STEP_SUMMARY;
  if (p) {
    appendFileSync(p, text, "utf8");
  }
}

function argvFlags(argv) {
  const out = { yesterdayUtc: false, appRoot: undefined };
  const rest = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yesterday-utc") out.yesterdayUtc = true;
    else if (a === "--app-root") {
      out.appRoot = argv[++i];
      if (!out.appRoot) throw new Error("--app-root needs a value");
    } else if (a.startsWith("-")) {
      throw new Error(`Unknown flag: ${a}`);
    } else rest.push(a);
  }
  return { ...out, positional: rest };
}

async function main() {
  const flags = argvFlags(process.argv);
  let startToken;
  let endToken;

  if (flags.yesterdayUtc) {
    const b = utcCalendarDayBoundsAsTokens(1);
    startToken = b.startToken;
    endToken = b.endToken;
  } else if (flags.positional.length === 2) {
    ({ startToken, endToken } = resolveDispatchRangeTokens(flags.positional[0], flags.positional[1]));
  } else {
    printUsage();
    process.exit(64);
  }

  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    console.error("Missing CURSOR_API_KEY");
    process.exit(1);
  }

  process.env.PROGRESS_BRANCH_PREFIX =
    process.env.PROGRESS_BRANCH_PREFIX?.trim() || "progress/ci-";

  const fotonozaRoot = getFotonozaRoot();
  const appRoot = resolveAppRoot(flags.appRoot);

  const startUtc = parseYyMmDdHhMmUtc(startToken);
  const endUtc = parseYyMmDdHhMmUtc(endToken);
  if (startUtc.getTime() > endUtc.getTime()) {
    console.error("Start instant must be <= end instant (UTC).");
    process.exit(64);
  }

  console.log(`[ci-progress] window ${startToken} … ${endToken} (UTC)`);
  console.log(`[ci-progress] fotonoza-app: ${appRoot}`);

  const plan = await planProgressRange({
    appRoot,
    rangeStartToken: startToken,
    rangeEndToken: endToken,
    startUtc,
    endUtc
  });

  if (!plan.ok) {
    console.log(`[ci-progress] ${plan.message}`);
    appendStepSummary(`## Progress plan\n\n${plan.message}\n`);
    process.exit(0);
  }

  const enMd = join(fotonozaRoot, "src", "content", "progress", "en", `${plan.slug}.md`);
  if (existsSync(enMd)) {
    const msg = `[ci-progress] English post already exists (${enMd}); skip generation and git.`;
    console.log(msg);
    appendStepSummary(
      `## Skipped (post exists)\n\n${msg}\n\n### Git payload (for review)\n\n\`\`\`text\n${plan.gitPayload.replace(/```/g, "\\`\\`\\`")}\n\`\`\`\n`
    );
    process.exit(0);
  }

  const payloadPath = join(fotonozaRoot, "git-progress-payload.txt");
  writeFileSync(payloadPath, plan.gitPayload, "utf8");
  console.log(`[ci-progress] wrote git payload to ${payloadPath}`);

  appendStepSummary(
    `## Progress git payload (${plan.shas.length} commit(s), slug \`${plan.slug}\`)\n\n` +
      `\`\`\`text\n${plan.gitPayload.replace(/```/g, "\\`\\`\\`")}\n\`\`\`\n`
  );

  await runProgressPipelineFromPlan(plan, { apiKey, fotonozaRoot });

  await maybeGitCommitPushPr({
    fotonozaRoot,
    slug: plan.slug,
    flags: { commit: true, push: true, noPr: false }
  });

  console.log(`[ci-progress] done ${plan.slug}`);
  appendStepSummary(`## Result\n\nGenerated \`${plan.slug}\` and opened or updated PR flow.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
