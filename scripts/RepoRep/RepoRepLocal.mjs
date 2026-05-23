#!/usr/bin/env node
import "dotenv/config";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { requireCursorApiKey } from "./agent/requireCursorApiKey.mjs";
import { getWebsiteRoot } from "./pipeline/fs.mjs";
import { runPipeline } from "./pipeline/run.mjs";
import { getProcessArgs } from "./validateArgs.mjs";

/** fotonoza-app checkout as sibling `../fotonoza-app` of this repo. */
function getSiblingAppRoot() {
  const appRoot = resolve(getWebsiteRoot(), "../fotonoza-app");
  if (!existsSync(join(appRoot, "package.json"))) {
    throw new Error(`Could not find fotonoza-app at ${appRoot}.`);
  }
  return appRoot;
}

async function main() {
  const { start, end } = getProcessArgs();

  requireCursorApiKey();

  const websiteRoot = getWebsiteRoot();
  const appRoot = getSiblingAppRoot();

  console.log(`[RepoRep-local] window ${start} … ${end} (UTC)`);
  console.log(`[RepoRep-local] fotonoza-app: ${appRoot}`);

  const pipeline = await runPipeline({ websiteRoot, appRoot });

  if (!pipeline.ok) {
    console.log(pipeline.message);
    process.exit(0);
  }

  console.log(`[RepoRep-local] wrote ${pipeline.slug}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
