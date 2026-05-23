/// <reference path="../types.mjs" />
import { formatGitPayload } from "../git/diff.mjs";
import { getCommitsInRange } from "../git/getCommitsInRange.mjs";
import { getProcessArgs } from "../validateArgs.mjs";
import { generatePostJson } from "../agent/generate.mjs";
import { makeImageFileName, makeSlug } from "./slug.mjs";
import { writeArtifacts } from "./artifacts.mjs";

/**
 * @param {PlanCtx} ctx
 * @returns {Promise<ProgressPlanOk | ProgressPlanNoCommits>}
 */
export async function planPipeline(ctx, { exitIfNotOk } = {}) {
  const { start, end, startDate, endDate } = getProcessArgs();
  const commits = await getCommitsInRange({
    appRoot: ctx.appRoot,
    startDate,
    endDate,
  });

  if (commits.length === 0) {
    const msg = `No commits in fotonoza-app with author date in [${startDate.toISOString()}, ${endDate.toISOString()}] (UTC).`;
    if (exitIfNotOk) {
      console.log(`[RepoRep] ${msg}`);
      process.exit(0);
    }
    return { ok: false, code: "NO_COMMITS", message: msg };
  }

  const shas = commits.map((c) => c.sha);
  const slug = makeSlug({ start, end, shas });
  const gitPayload = await formatGitPayload({ appRoot: ctx.appRoot, shas });

  return {
    ok: true,
    ...ctx,
    start,
    end,
    startDate,
    endDate,
    commits,
    shas,
    slug,
    gitPayload,
  };
}

/**
 * @param {ProgressPlanOk} plan
 * @param {PipelineCtx} ctx
 * @returns {Promise<PipelineRunOk>}
 */
export async function runPipelineFromPlan(plan, ctx) {
  const merged = { ...ctx, ...plan };

  console.log(
    `[pipeline] ${plan.commits.length} commit(s) → slug ${plan.slug}`,
  );
  const { post, runId, diffSummary } = await generatePostJson(merged);
  console.log(`[pipeline] Cursor run id: ${runId}`);

  const imageWebPath = `/progress/${makeImageFileName(post.coverWord.trim(), plan.shas)}`;
  const { mdPath, plPath } = await writeArtifacts({
    ...merged,
    post,
    diffSummary,
    imageWebPath,
    commitShas: plan.shas,
  });

  console.log(`[pipeline] wrote ${mdPath} and ${plPath}`);

  return {
    ok: true,
    slug: plan.slug,
    mdPath,
    runId,
    shas: plan.shas,
    gitPayload: plan.gitPayload,
    diffSummary,
  };
}

/**
 * @param {PipelineCtx} ctx
 * @returns {Promise<PipelineRunOk | ProgressPlanNoCommits>}
 */
export async function runPipeline(ctx) {
  const plan = await planPipeline(ctx);
  if (!plan.ok) {
    return plan;
  }
  return runPipelineFromPlan(plan, ctx);
}
