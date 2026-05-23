/// <reference path="../types.mjs" />
import { Agent, CursorAgentError } from "@cursor/sdk";

/** @typedef {{ apiKey: string; websiteRoot: string; model?: { id: string } }} SessionOpts */

/** @typedef {string | ((previousResult: string) => string)} AgentStep */

/**
 * Run sequential turns on one agent (conversation context retained).
 * @param {AgentStep[]} steps
 * @param {SessionOpts} opts
 * @returns {Promise<{ runIds: string[]; lastText: string }>}
 */
export async function runAgentSteps(steps, opts) {
  const agent = await Agent.create({
    apiKey: opts.apiKey,
    model: opts.model ?? { id: "composer-2" },
    local: { cwd: opts.websiteRoot, settingSources: [] },
  });

  const runIds = [];
  let lastText = "";

  try {
    for (const step of steps) {
      const message = typeof step === "function" ? step(lastText) : step;
      const run = await agent.send(message);
      const result = await run.wait();
      runIds.push(result.id);

      if (result.status === "error") {
        console.error("[cursor] run finished with error status", result.id);
        throw new Error(result.result?.slice(0, 2000) ?? "unknown agent error");
      }

      lastText = result.result ?? "";
    }
  } catch (e) {
    if (e instanceof CursorAgentError) {
      console.error(
        "[cursor] CursorAgentError",
        e.message,
        "retryable=",
        e.isRetryable,
      );
    }
    throw e;
  } finally {
    agent.close();
  }

  return { runIds, lastText };
}
