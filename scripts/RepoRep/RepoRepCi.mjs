#!/usr/bin/env node
/**
 * CI / scheduled entry: plan from fotonoza-app git → log payload → Cursor → write markdown → commit/push/PR.
 * Local fallback: `npm run reporep:local`.
 */
import "dotenv/config";
import { requireCursorApiKey } from "./agent/requireCursorApiKey.mjs";
import { gitCommitPushPr } from "./git/pr.mjs";
import {
  resolveAppRoots,
  persistGitPayload,
  exitIfContentFilesExist,
} from "./pipeline/fs.mjs";
import { getProcessArgs } from "./validateArgs.mjs";
import { planPipeline, runPipelineFromPlan } from "./pipeline/run.mjs";

async function main() {
  const { start, end } = getProcessArgs();

  requireCursorApiKey();

  const { websiteRoot, appRoot } = await resolveAppRoots();

  console.log(`[RepoRep] window ${start} … ${end} (UTC)`);
  console.log(`[RepoRep] fotonoza-app: ${appRoot}`);

  const plan = await planPipeline({ appRoot }, { exitIfNotOk: true });

  await exitIfContentFilesExist({ slug: plan.slug });

  await persistGitPayload({ gitPayload: plan.gitPayload });

  await runPipelineFromPlan(plan, { websiteRoot, appRoot });

  await gitCommitPushPr(
    {
      websiteRoot,
      slug: plan.slug,
    },
    {
      prBody: (slug) => `[RepoRep] Automated progress post \`${slug}\`.`,
    },
  );

  console.log(`[RepoRep] done ${plan.slug}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
