import {
  formatGitPayload,
  listCommitsByAuthorDateInRange
} from "./gitCommitsInRange.mjs";
import { generateProgressPostJson } from "./generateWithCursor.mjs";
import { makeCoverImageFileName, makeProgressSlug } from "./slug.mjs";
import { writeProgressArtifacts } from "./writeProgressDoc.mjs";

/**
 * @typedef {{
 *   ok: true;
 *   rangeStartToken: string;
 *   rangeEndToken: string;
 *   startUtc: Date;
 *   endUtc: Date;
 *   commits: { sha: string; authorDate: Date }[];
 *   shas: string[];
 *   slug: string;
 *   gitPayload: string;
 * }} ProgressPlanOk
 */

/**
 * @typedef {{ ok: false; code: "NO_COMMITS"; message: string }} ProgressPlanNoCommits
 */

/**
 * Git history + slug for a UTC window (no Cursor call).
 * @param {{
 *   appRoot: string;
 *   rangeStartToken: string;
 *   rangeEndToken: string;
 *   startUtc: Date;
 *   endUtc: Date;
 * }} opts
 * @returns {Promise<ProgressPlanOk | ProgressPlanNoCommits>}
 */
export async function planProgressRange(opts) {
  const commits = await listCommitsByAuthorDateInRange({
    appRoot: opts.appRoot,
    startInclusive: opts.startUtc,
    endInclusive: opts.endUtc
  });

  if (commits.length === 0) {
    const msg =
      `No commits in fotonoza-app with author date in [${opts.startUtc.toISOString()}, ${opts.endUtc.toISOString()}] (UTC).`;
    return { ok: false, code: "NO_COMMITS", message: msg };
  }

  const shas = commits.map((c) => c.sha);
  const slug = makeProgressSlug({
    rangeStartToken: opts.rangeStartToken,
    rangeEndToken: opts.rangeEndToken,
    shas
  });

  const gitPayload = await formatGitPayload({ appRoot: opts.appRoot, shas });

  return {
    ok: true,
    rangeStartToken: opts.rangeStartToken,
    rangeEndToken: opts.rangeEndToken,
    startUtc: opts.startUtc,
    endUtc: opts.endUtc,
    commits,
    shas,
    slug,
    gitPayload
  };
}

/**
 * Cursor + markdown write from a prior {@link planProgressRange} result.
 * @param {ProgressPlanOk} plan
 * @param {{ apiKey: string; fotonozaRoot: string }} opts
 */
export async function runProgressPipelineFromPlan(plan, opts) {
  const { gitPayload, rangeStartToken, rangeEndToken, shas, slug } = plan;

  console.log(`[pipeline] ${plan.commits.length} commit(s) → slug ${slug}`);
  const { post, runId } = await generateProgressPostJson({
    apiKey: opts.apiKey,
    fotonozaRoot: opts.fotonozaRoot,
    gitPayload,
    rangeStartToken,
    rangeEndToken
  });
  console.log(`[pipeline] Cursor run id: ${runId}`);

  const imageFile = makeCoverImageFileName(post.coverWord.trim(), shas);
  const imageWebPath = `/progress/${imageFile}`;
  const { mdPath, plPath } = await writeProgressArtifacts({
    fotonozaRoot: opts.fotonozaRoot,
    slug,
    title: post.title,
    description: post.description,
    titlePl: post.titlePl,
    descriptionPl: post.descriptionPl,
    pubDateIso: post.pubDate,
    imageWebPath,
    rangeStartToken,
    rangeEndToken,
    commitShas: shas,
    bodyMarkdown: post.body,
    bodyMarkdownPl: post.bodyPl
  });

  console.log(`[pipeline] wrote ${mdPath} and ${plPath}`);

  return {
    ok: true,
    slug,
    mdPath,
    runId,
    shas,
    gitPayload
  };
}

/**
 * Range → markdown under fotonoza; `image:` points at `/progress/{word}-{5hex}.png` (asset optional).
 *
 * @param {{
 *   apiKey: string;
 *   fotonozaRoot: string;
 *   appRoot: string;
 *   rangeStartToken: string;
 *   rangeEndToken: string;
 *   startUtc: Date;
 *   endUtc: Date;
 * }} opts
 * @returns {Promise<
 *   | { ok: true; slug: string; mdPath: string; runId: string; shas: string[]; gitPayload: string }
 *   | { ok: false; code: "NO_COMMITS"; message: string }
 * >}
 */
export async function runProgressPipeline(opts) {
  const plan = await planProgressRange(opts);
  if (!plan.ok) {
    return plan;
  }
  return runProgressPipelineFromPlan(plan, {
    apiKey: opts.apiKey,
    fotonozaRoot: opts.fotonozaRoot
  });
}
