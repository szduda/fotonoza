/**
 * @typedef {{ websiteRoot: string; slug: string }} GitPublishParams
 */

/**
 * @typedef {{
 *   branchPrefix?: string;
 *   prBase?: string;
 *   commitMessage?: (slug: string) => string;
 *   prBody?: (slug: string) => string;
 * }} GitPublishProfile
 */

/**
 * @typedef {{ start: string; end: string; startDate: Date; endDate: Date }} ProcessArgs
 */

/**
 * @typedef {{ sha: string; authorDate: Date }} GitCommit
 */

/**
 * @typedef {{ appRoot: string }} PlanCtx
 */

/**
 * @typedef {PlanCtx & ProcessArgs & {
 *   ok: true;
 *   commits: GitCommit[];
 *   shas: string[];
 *   slug: string;
 *   gitPayload: string;
 * }} ProgressPlanOk
 */

/**
 * @typedef {{ ok: false; code: "NO_COMMITS"; message: string }} ProgressPlanNoCommits
 */

/**
 * @typedef {PlanCtx & {
 *   websiteRoot: string;
 * }} PipelineCtx
 */

/**
 * @typedef {{
 *   ok: true;
 *   slug: string;
 *   mdPath: string;
 *   runId: string;
 *   shas: string[];
 *   gitPayload: string;
 *   diffSummary: string;
 * }} PipelineRunOk
 */

/**
 * @typedef {{
 *   title: string;
 *   description: string;
 *   titlePl: string;
 *   descriptionPl: string;
 *   pubDate: string;
 *   body: string;
 *   bodyPl: string;
 *   coverWord: string;
 * }} GeneratedPost
 */

/**
 * @typedef {{
 *   websiteRoot: string;
 *   appRoot: string;
 *   shas: string[];
 *   gitPayload: string;
 *   start: string;
 *   end: string;
 * }} AgentCtx
 */

/**
 * @typedef {{ gitPayload: string; diffSummary: string; start: string; end: string }} PromptCtx
 */

/**
 * @typedef {{
 *   locale: string;
 *   title: string;
 *   description: string;
 *   pubDateIso: string;
 *   imageWebPath: string;
 *   start: string;
 *   end: string;
 *   commitShas: string[];
 *   changeSummary: string;
 *   bodyMarkdown: string;
 *   leadImgAlt: string;
 * }} MarkdownDoc
 */

/**
 * @typedef {{
 *   websiteRoot: string;
 *   slug: string;
 *   post: GeneratedPost;
 *   diffSummary: string;
 *   imageWebPath: string;
 *   start: string;
 *   end: string;
 *   commitShas: string[];
 * }} WriteArtifactsCtx
 */

/**
 * @typedef {{ appRoot: string; startDate: Date; endDate: Date }} ListCommitsCtx
 */

/**
 * @typedef {{ appRoot: string; shas: string[] }} GitPayloadCtx
 */

/**
 * @typedef {{ start: string; end: string; shas: string[] }} SlugInput
 */

/**
 * @typedef {{ gitPayload: string }} PersistGitPayloadOpts
 */

export {};
