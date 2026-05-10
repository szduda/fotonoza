import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Writes English source under `src/content/progress/en/{slug}.md`.
 * Add `src/content/progress/pl/{slug}.md` with `locale: pl` and the same
 * `image`, `pubDate`, `range*`, `commitShas` when translating (do not use a
 * frontmatter key named `slug` — Astro reserves it for content ids).
 */

/**
 * @param {{
 *   fotonozaRoot: string;
 *   slug: string;
 *   title: string;
 *   description: string;
 *   pubDateIso: string;
 *   imageWebPath: string;
 *   rangeStartToken: string;
 *   rangeEndToken: string;
 *   commitShas: string[];
 *   bodyMarkdown: string;
 * }} opts
 */
export async function writeProgressArtifacts(opts) {
  const {
    fotonozaRoot,
    slug,
    title,
    description,
    pubDateIso,
    imageWebPath,
    rangeStartToken,
    rangeEndToken,
    commitShas,
    bodyMarkdown
  } = opts;

  const mdPath = join(fotonozaRoot, "src", "content", "progress", "en", `${slug}.md`);
  await mkdir(dirname(mdPath), { recursive: true });

  const fm = [
    "---",
    `locale: "en"`,
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    `pubDate: ${JSON.stringify(pubDateIso)}`,
    `image: ${JSON.stringify(imageWebPath)}`,
    `rangeStart: ${JSON.stringify(rangeStartToken)}`,
    `rangeEnd: ${JSON.stringify(rangeEndToken)}`,
    `commitShas: ${JSON.stringify(commitShas.join(","))}`,
    "---",
    "",
    bodyMarkdown.trim(),
    ""
  ].join("\n");

  await writeFile(mdPath, fm, "utf8");
  return { mdPath };
}
