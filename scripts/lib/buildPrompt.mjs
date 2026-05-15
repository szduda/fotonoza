/**
 * @param {{
 *   gitPayload: string;
 *   rangeStartToken: string;
 *   rangeEndToken: string;
 * }} p
 */
export function buildProgressPrompt(p) {
  return `You are writing **one chapter** of an ongoing dev diary for **fotonoza** — the marketing site for a photo editor **web app** (React + Vite; source lives in repo fotonoza-app).

## The bigger story (carry this energy in every post)

We are building a **deliberately small but genuinely powerful** editor: not a Lightroom clone, not a pro studio suite — the **~20% of features that ~80% of serious hobbyists and advanced-amateurs** (people who care about color and crops, but are *not* living in billing-by-the-hour retouching workflows) actually lean on day to day.

Each post is a **beat in that longer arc**: curiosity, frustration, small wins, “why we said no to feature bloat,” and the quiet satisfaction when something *feels* right. Readers should feel they are **following a real build**, not a changelog robot.

Tone: **warm, human, a little playful** — story first, then facts. Emotions are welcome (excited, skeptical, relieved, obsessed). Avoid corporate marketing speak and dry bullet dumps. You can be opinionated about tradeoffs.

The entry will ship on the static Astro site **fotonoza** with a **cover image** added later by the maintainer (PNG under \`public/progress/\`, URL in frontmatter). Describe the UI as it plausibly looks given the commits — readers will see the image alongside your words.

## Git activity (fotonoza-app) for this batch

${p.gitPayload}

## Required output

Reply with **only** a single JSON object (no markdown outside the JSON). The JSON must match this shape exactly in structure and types:

{
  "title": "short headline",
  "description": "one line for meta / listing",
  "pubDate": "ISO-8601 UTC instant string (metadata only — the site shows one human-facing date above the title; readers never see this raw string in the article)",
  "body": "Markdown body only (no YAML frontmatter). Use ## headings sparingly; prefer flowing paragraphs with occasional emphasis."
}

### Narrative checklist

- Tie this batch of commits to the **north star** above (simple surface, deep usefulness for advanced-amateurs).
- **Voice**: fun, narrative, emotional — like a builder talking to friends, not a press release.
- **Continuity**: nod to this being **episode N** of an ongoing story (one short phrase is enough: e.g. “another week on the slow road to…”).

### Dates (strict)

- **Do not** put dates, times, or ranges in **title**, **description**, or **body** — no calendar phrases (“on May 10…”), no week labels tied to a clock, no **ISO-8601** strings, no **yyMMddHHmm** tokens, no “between timestamps … UTC”, no committer/author timestamps, and no “last Tuesday”-style anchors.
- The page already shows a single publication line above the headline; **that** is the only date the reader needs. Your job is story and product, not a timeline recap.
- The JSON \`pubDate\` field is still required (ISO string for the CMS) but must **not** be echoed or paraphrased inside title, description, or body.

Do not include keys other than title, description, pubDate, body.`;
}
