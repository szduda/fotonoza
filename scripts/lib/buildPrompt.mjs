/**
 * @param {{
 *   gitPayload: string;
 *   rangeStartToken: string;
 *   rangeEndToken: string;
 *   previewOrigin: string;
 *   screenshotHeadSha: string;
 * }} p
 */
export function buildProgressPrompt(p) {
  const shortSha = p.screenshotHeadSha.slice(0, 7);
  return `You are writing **one chapter** of an ongoing dev diary for **fotonoza** — the marketing site for a photo editor **web app** (React + Vite; source lives in repo fotonoza-app).

## The bigger story (carry this energy in every post)

We are building a **deliberately small but genuinely powerful** editor: not a Lightroom clone, not a pro studio suite — the **~20% of features that ~80% of serious hobbyists and advanced-amateurs** (people who care about color and crops, but are *not* living in billing-by-the-hour retouching workflows) actually lean on day to day.

Each post is a **beat in that longer arc**: curiosity, frustration, small wins, “why we said no to feature bloat,” and the quiet satisfaction when something *feels* right. Readers should feel they are **following a real build**, not a changelog robot.

Tone: **warm, human, a little playful** — story first, then facts. Emotions are welcome (excited, skeptical, relieved, obsessed). Avoid corporate marketing speak and dry bullet dumps. You can be opinionated about tradeoffs.

The entry will ship on the static Astro site **fotonoza** with a screenshot from \`vite preview\` of the app **frozen at commit ${shortSha}** — the **newest commit in this UTC window** — so describe the UI as it plausibly looks **at that moment** in the journey.

## Git activity (fotonoza-app) in the requested UTC window

${p.gitPayload}

## Required output

Reply with **only** a single JSON object (no markdown outside the JSON). The JSON must match this shape exactly in structure and types:

{
  "title": "short headline",
  "description": "one line for meta / listing",
  "pubDate": "ISO-8601 UTC instant string",
  "body": "Markdown body only (no YAML frontmatter). Use ## headings sparingly; prefer flowing paragraphs with occasional emphasis.",
  "screenshotPlan": {
    "steps": [
      { "type": "setViewport", "width": 1280, "height": 720 },
      { "type": "goto", "path": "/" },
      { "type": "waitForLoadState", "state": "networkidle" },
      { "type": "screenshot", "fullPage": true }
    ]
  }
}

### screenshotPlan rules

- \`previewOrigin\` for the runner is: ${p.previewOrigin}
- The runner builds and captures the app **at commit ${shortSha}** (newest in window); plan steps for **that** UI.
- Each \`goto.path\` must start with \`/\` and is appended to that origin (e.g. \`/\` loads the app root).
- Allowed step \`type\` values only: "goto", "waitForSelector", "waitForLoadState", "waitForTimeout", "setViewport", "screenshot".
- **Last step must be** \`{ "type": "screenshot", "fullPage": true|false }\`.
- Prefer stable selectors if you use \`waitForSelector\` (e.g. \`#root\`, \`main\`).
- \`waitForLoadState.state\` is one of: "load", "domcontentloaded", "networkidle".
- \`waitForTimeout.ms\` must be between 0 and 120000.

### Narrative checklist

- Tie this batch of commits to the **north star** above (simple surface, deep usefulness for advanced-amateurs).
- **Voice**: fun, narrative, emotional — like a builder talking to friends, not a press release.
- **Continuity**: nod to this being **episode N** of an ongoing story (one short phrase is enough: e.g. “another week on the slow road to…”).
- Mention the UTC window once in prose: range tokens ${p.rangeStartToken} .. ${p.rangeEndToken} (yyMMddHHmm, UTC).

Do not include keys other than title, description, pubDate, body, screenshotPlan.`;
}
