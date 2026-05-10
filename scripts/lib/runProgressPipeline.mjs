import { mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import {
  formatGitPayload,
  listCommitsByAuthorDateInRange,
  withAppRepoAtCommitForScreenshot
} from "./gitCommitsInRange.mjs";
import { generateProgressPostJson } from "./generateWithCursor.mjs";
import { makeProgressSlug } from "./slug.mjs";
import { runScreenshotPlan } from "./runScreenshotPlan.mjs";
import { sanitizedProcessEnv } from "./sanitizeEnv.mjs";
import { writeProgressArtifacts } from "./writeProgressDoc.mjs";

const execFileAsync = promisify(execFile);

/**
 * Range → markdown + PNG under fotonoza. Shared entry for backfill and (later) CI.
 *
 * @param {{
 *   apiKey: string;
 *   fotonozaRoot: string;
 *   appRoot: string;
 *   rangeStartToken: string;
 *   rangeEndToken: string;
 *   startUtc: Date;
 *   endUtc: Date;
 *   previewOrigin?: string;
 * }} opts
 * @returns {Promise<{ slug: string; pngPath: string; mdPath: string; runId: string; shas: string[] }>}
 */
export async function runProgressPipeline(opts) {
  const previewOrigin = (opts.previewOrigin ?? process.env.FOTONOZA_PREVIEW_URL ?? "http://127.0.0.1:4173").replace(
    /\/$/,
    ""
  );

  const commits = await listCommitsByAuthorDateInRange({
    appRoot: opts.appRoot,
    startInclusive: opts.startUtc,
    endInclusive: opts.endUtc
  });

  if (commits.length === 0) {
    const msg =
      `No commits in fotonoza-app with author date in [${opts.startUtc.toISOString()}, ${opts.endUtc.toISOString()}] (UTC).`;
    const err = new Error(msg);
    err.code = "NO_COMMITS";
    throw err;
  }

  const shas = commits.map((c) => c.sha);
  const slug = makeProgressSlug({
    rangeStartToken: opts.rangeStartToken,
    rangeEndToken: opts.rangeEndToken,
    shas
  });

  const gitPayload = await formatGitPayload({ appRoot: opts.appRoot, shas });
  /** Newest commit in the window (author-date order): build + screenshot use this tree. */
  const screenshotHeadSha = shas[shas.length - 1];

  console.log(`[pipeline] ${commits.length} commit(s) → slug ${slug}`);
  const { post, runId } = await generateProgressPostJson({
    apiKey: opts.apiKey,
    fotonozaRoot: opts.fotonozaRoot,
    gitPayload,
    rangeStartToken: opts.rangeStartToken,
    rangeEndToken: opts.rangeEndToken,
    previewOrigin,
    screenshotHeadSha
  });
  console.log(`[pipeline] Cursor run id: ${runId}`);

  const pngPath = join(opts.fotonozaRoot, "public", "progress", `${slug}.png`);
  await mkdir(join(opts.fotonozaRoot, "public", "progress"), { recursive: true });

  const buildEnv = sanitizedProcessEnv();
  await withAppRepoAtCommitForScreenshot({
    appRoot: opts.appRoot,
    targetSha: screenshotHeadSha,
    fn: async () => {
      console.log(`[pipeline] fotonoza-app @ ${screenshotHeadSha.slice(0, 7)} (detached) — build + screenshot`);
      console.log("[pipeline] npm run build (fotonoza-app)…");
      await execFileAsync("npm", ["run", "build"], {
        cwd: opts.appRoot,
        env: buildEnv,
        maxBuffer: 50 * 1024 * 1024
      });
      console.log("[pipeline] Playwright + vite preview…");
      await runScreenshotPlan({
        appRoot: opts.appRoot,
        previewOrigin,
        steps: post.screenshotPlan.steps,
        outPngPath: pngPath
      });
    }
  });
  console.log("[pipeline] restored fotonoza-app to previous HEAD");

  const imageWebPath = `/progress/${slug}.png`;
  const { mdPath } = await writeProgressArtifacts({
    fotonozaRoot: opts.fotonozaRoot,
    slug,
    title: post.title,
    description: post.description,
    pubDateIso: post.pubDate,
    imageWebPath,
    rangeStartToken: opts.rangeStartToken,
    rangeEndToken: opts.rangeEndToken,
    commitShas: shas,
    bodyMarkdown: post.body
  });

  return { slug, pngPath, mdPath, runId, shas };
}
