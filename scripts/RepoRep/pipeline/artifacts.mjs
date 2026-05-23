/// <reference path="../types.mjs" />
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getMdPath } from "./fs.mjs";

/**
 * Writes `src/content/progress/en/{slug}.md` and `src/content/progress/pl/{slug}.md`.
 * Do not use a frontmatter key named `slug` — Astro reserves it for content ids.
 */

/** @param {MarkdownDoc} doc */
function buildMarkdownDoc(doc) {
  const fm = [
    "---",
    `locale: ${JSON.stringify(doc.locale)}`,
    `title: ${JSON.stringify(doc.title)}`,
    `description: ${JSON.stringify(doc.description)}`,
    `pubDate: ${JSON.stringify(doc.pubDateIso)}`,
    `image: ${JSON.stringify(doc.imageWebPath)}`,
    `rangeStart: ${JSON.stringify(doc.start)}`,
    `rangeEnd: ${JSON.stringify(doc.end)}`,
    `commitShas: ${JSON.stringify(doc.commitShas.join(","))}`,
    `changeSummary: ${JSON.stringify(doc.changeSummary)}`,
    "---",
    "",
  ].join("\n");

  const leadImg = `<img src=${JSON.stringify(doc.imageWebPath)} alt=${JSON.stringify(doc.leadImgAlt)} width="1280" loading="lazy" />\n\n`;

  return `${fm}${leadImg}${doc.bodyMarkdown.trim()}\n`;
}

/** @param {WriteArtifactsCtx} ctx */
export async function writeArtifacts(ctx) {
  const { slug, post, diffSummary } = ctx;

  const localeDocs = [
    {
      locale: "en",
      title: post.title,
      description: post.description,
      bodyMarkdown: post.body,
      leadImgAlt: `Progress — ${post.title}`,
    },
    {
      locale: "pl",
      title: post.titlePl,
      description: post.descriptionPl,
      bodyMarkdown: post.bodyPl,
      leadImgAlt: `Postęp — ${post.titlePl}`,
    },
  ];

  const paths = {};
  await Promise.all(
    localeDocs.map(async (localeDoc) => {
      const path = getMdPath(localeDoc.locale, slug);
      paths[localeDoc.locale] = path;
      await mkdir(dirname(path), { recursive: true });
      await writeFile(
        path,
        buildMarkdownDoc({
          pubDateIso: post.pubDate,
          changeSummary: diffSummary,
          imageWebPath: ctx.imageWebPath,
          start: ctx.start,
          end: ctx.end,
          commitShas: ctx.commitShas,
          ...localeDoc,
        }),
        "utf8",
      );
    }),
  );

  return { mdPath: paths.en, plPath: paths.pl };
}
