/// <reference path="../types.mjs" />

/** @param {{ gitPayload: string; aggregatedDiff: string }} ctx */
export function buildDiffSummaryPrompt(ctx) {
  return `You are helping document development on **fotonoza-app**, a photo editor web app (React + Vite).

You will receive **technical git context** for one batch of commits: full commit messages (as the author wrote them) and per-commit stats, plus an **aggregated unified diff** across those commits.

## Commit messages and stats

${ctx.gitPayload}

## Aggregated diff (all commits in this batch)

${ctx.aggregatedDiff}

## Your task

Write **one paragraph only** (plain text, no markdown, no JSON, no title line):

- **50–200 words**, in clear human language from a **user/editor perspective** (what changed for someone using the app, not a file list).
- Summarize **all changes together** as one story beat—do not go commit-by-commit.
- You may infer UX impact from the diff; stay plausible and grounded in what was actually changed.
- Do **not** include dates, SHAs, branch names, or "in this commit" phrasing.

Reply with **only** that paragraph.`;
}
