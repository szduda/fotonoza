import { Agent, CursorAgentError } from "@cursor/sdk";
import { buildProgressPrompt } from "./buildPrompt.mjs";
import { extractJsonFromModelText } from "./extractJson.mjs";
import { assertGeneratedPost } from "./validateGeneratedPost.mjs";

/**
 * @param {{
 *   apiKey: string;
 *   fotonozaRoot: string;
 *   gitPayload: string;
 *   rangeStartToken: string;
 *   rangeEndToken: string;
 *   previewOrigin: string;
 *   screenshotHeadSha: string;
 * }} opts
 */
export async function generateProgressPostJson(opts) {
  const prompt = buildProgressPrompt({
    gitPayload: opts.gitPayload,
    rangeStartToken: opts.rangeStartToken,
    rangeEndToken: opts.rangeEndToken,
    previewOrigin: opts.previewOrigin,
    screenshotHeadSha: opts.screenshotHeadSha
  });

  try {
    const result = await Agent.prompt(prompt, {
      apiKey: opts.apiKey,
      model: { id: "composer-2" },
      local: { cwd: opts.fotonozaRoot, settingSources: [] }
    });

    if (result.status === "error") {
      console.error("[cursor] run finished with error status", result.id);
      throw new Error(result.result?.slice(0, 2000) ?? "unknown agent error");
    }

    const raw = result.result ?? "";
    let parsed;
    try {
      parsed = extractJsonFromModelText(raw);
    } catch (e) {
      const hint = raw.slice(0, 1500);
      throw new Error(`Failed to parse JSON from agent: ${e.message}\n---\n${hint}`);
    }
    assertGeneratedPost(parsed);
    return { post: parsed, runId: result.id };
  } catch (e) {
    if (e instanceof CursorAgentError) {
      console.error("[cursor] CursorAgentError", e.message, "retryable=", e.isRetryable);
    }
    throw e;
  }
}
