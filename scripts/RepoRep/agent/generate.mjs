/// <reference path="../types.mjs" />
import { collectAggregatedDiff } from "../git/diff.mjs";
import { buildDiffSummaryPrompt } from "./buildDiffSummaryPrompt.mjs";
import { buildProgressPrompt } from "./buildArticlePrompt.mjs";
import { runAgentSteps } from "./cursorSession.mjs";
import { extractJsonFromModelText } from "./extractJson.mjs";
import { assertGeneratedPost, parseDiffSummaryText } from "./validate.mjs";

/** @param {AgentCtx} ctx */
export async function generatePostJson(ctx) {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing CURSOR_API_KEY (set in environment or .env)");
  }

  console.log("[cursor] collecting aggregated diff for summary…");
  const aggregatedDiff = await collectAggregatedDiff(ctx.appRoot, ctx.shas);

  /** @type {string} */
  let diffSummary = "";

  const { runIds, lastText: articleRaw } = await runAgentSteps(
    [
      buildDiffSummaryPrompt({ gitPayload: ctx.gitPayload, aggregatedDiff }),
      (summaryRaw) => {
        diffSummary = parseDiffSummaryText(summaryRaw);
        console.log(
          `[cursor] diff summary (${diffSummary.split(/\s+/).filter(Boolean).length} words)`,
        );
        return buildProgressPrompt({
          gitPayload: ctx.gitPayload,
          diffSummary,
          start: ctx.start,
          end: ctx.end,
        });
      },
    ],
    { apiKey, websiteRoot: ctx.websiteRoot },
  );

  let parsed;
  try {
    parsed = extractJsonFromModelText(articleRaw);
  } catch (e) {
    const hint = articleRaw.slice(0, 1500);
    throw new Error(
      `Failed to parse JSON from agent: ${e.message}\n---\n${hint}`,
    );
  }
  assertGeneratedPost(parsed);

  return {
    post: /** @type {GeneratedPost} */ (parsed),
    runId: runIds.at(-1) ?? "",
    diffSummary,
  };
}
