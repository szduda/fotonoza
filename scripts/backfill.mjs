#!/usr/bin/env node
import "dotenv/config";
import { parseYyMmDdHhMmUtc } from "./lib/parseYyMmDdHhMm.mjs";
import { getFotonozaRoot, resolveAppRoot } from "./lib/paths.mjs";
import { runBackfillRange } from "./lib/backfillCore.mjs";

function printUsage() {
  console.error(`Usage: npm run backfill -- <yyMMddHHmm> <yyMMddHHmm> [options]

  Primary automation is GitHub Actions (workflow progress-generate.yml); this command is a local fallback.

  Inclusive UTC window on **author date** in fotonoza-app. Produces exactly one
  progress post (English markdown + frontmatter) under this repo. Add the cover
  PNG at public/progress/<slug>.png before merging (same slug as the .md file).

Options:
  --app-root <path>   Override FOTONOZA_APP_ROOT
  --commit            Create branch progress/backfill-… and git add (fotonoza repo)
  --push              Push branch (implies --commit)
  --no-pr             With --push, skip gh pr create

Environment:
  CURSOR_API_KEY      Required
  FOTONOZA_APP_ROOT   Optional path to fotonoza-app
  FOTONOZA_GIT_URL    Optional; with --push, HTTPS URL with PAT for this repo (git push + gh pr)
`);
}

function argvFlags(argv) {
  const out = { commit: false, push: false, noPr: false, appRoot: undefined };
  const rest = [];
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
    } else rest.push(a);
  }
  return { ...out, positional: rest };
}

async function main() {
  const flags = argvFlags(process.argv);
  const [a, b] = flags.positional;
  if (!a || !b) {
    printUsage();
    process.exit(64);
  }

  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    console.error("Missing CURSOR_API_KEY (set in environment or .env)");
    process.exit(1);
  }

  const startUtc = parseYyMmDdHhMmUtc(a);
  const endUtc = parseYyMmDdHhMmUtc(b);
  if (startUtc.getTime() > endUtc.getTime()) {
    console.error("Start instant must be <= end instant (UTC).");
    process.exit(64);
  }

  const fotonozaRoot = getFotonozaRoot();
  const appRoot = resolveAppRoot(flags.appRoot);

  try {
    const result = await runBackfillRange({
      startToken: a,
      endToken: b,
      apiKey,
      fotonozaRoot,
      appRoot,
      flags
    });
    if (result.outcome === "no_commits") {
      console.log(result.message);
      process.exit(0);
    }
    console.log(`[backfill] wrote ${result.slug}`);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
