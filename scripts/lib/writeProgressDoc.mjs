import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Writes `src/content/progress/en/{slug}.md` and `src/content/progress/pl/{slug}.md`.
 * Do not use a frontmatter key named `slug` — Astro reserves it for content ids.
 */

/**
 * @param {{
 *   locale: string;
 *   title: string;
 *   description: string;
 *   pubDateIso: string;
 *   imageWebPath: string;
 *   rangeStartToken: string;
 *   rangeEndToken: string;
 *   commitShas: string[];
 *   bodyMarkdown: string;
 *   leadImgAlt: string;
 * }} p
 */
function buildMarkdownDoc(p) {
  const fm = [
    "---",
    `locale: ${JSON.stringify(p.locale)}`,
    `title: ${JSON.stringify(p.title)}`,
    `description: ${JSON.stringify(p.description)}`,
    `pubDate: ${JSON.stringify(p.pubDateIso)}`,
    `image: ${JSON.stringify(p.imageWebPath)}`,
    `rangeStart: ${JSON.stringify(p.rangeStartToken)}`,
    `rangeEnd: ${JSON.stringify(p.rangeEndToken)}`,
    `commitShas: ${JSON.stringify(p.commitShas.join(","))}`,
    "---",
    ""
  ].join("\n");

  const leadImg = `<img src=${JSON.stringify(p.imageWebPath)} alt=${JSON.stringify(p.leadImgAlt)} width="1280" loading="lazy" />\n\n`;

  return `${fm}${leadImg}${p.bodyMarkdown.trim()}\n`;
}

/**
 * @param {{
 *   fotonozaRoot: string;
 *   slug: string;
 *   title: string;
 *   description: string;
 *   titlePl: string;
 *   descriptionPl: string;
 *   pubDateIso: string;
 *   imageWebPath: string;
 *   rangeStartToken: string;
 *   rangeEndToken: string;
 *   commitShas: string[];
 *   bodyMarkdown: string;
 *   bodyMarkdownPl: string;
 * }} opts
 */
export async function writeProgressArtifacts(opts) {
  const {
    fotonozaRoot,
    slug,
    title,
    description,
    titlePl,
    descriptionPl,
    pubDateIso,
    imageWebPath,
    rangeStartToken,
    rangeEndToken,
    commitShas,
    bodyMarkdown,
    bodyMarkdownPl
  } = opts;

  const enPath = join(fotonozaRoot, "src", "content", "progress", "en", `${slug}.md`);
  const plPath = join(fotonozaRoot, "src", "content", "progress", "pl", `${slug}.md`);
  await mkdir(dirname(enPath), { recursive: true });
  await mkdir(dirname(plPath), { recursive: true });

  const enDoc = buildMarkdownDoc({
    locale: "en",
    title,
    description,
    pubDateIso,
    imageWebPath,
    rangeStartToken,
    rangeEndToken,
    commitShas,
    bodyMarkdown,
    leadImgAlt: `Progress — ${title}`
  });

  const plDoc = buildMarkdownDoc({
    locale: "pl",
    title: titlePl,
    description: descriptionPl,
    pubDateIso,
    imageWebPath,
    rangeStartToken,
    rangeEndToken,
    commitShas,
    bodyMarkdown: bodyMarkdownPl,
    leadImgAlt: `Postęp — ${titlePl}`
  });

  await writeFile(enPath, enDoc, "utf8");
  await writeFile(plPath, plDoc, "utf8");
  return { mdPath: enPath, plPath };
}
