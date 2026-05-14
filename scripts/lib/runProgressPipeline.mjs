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

/** @param {unknown} e */
function formatExecError(e) {
  if (e && typeof e === "object") {
    const err = /** @type {{ stderr?: unknown; stdout?: unknown; message?: string }} */ (e);
    const s = [err.stderr, err.stdout].filter(Boolean).join("\n").trim();
    if (s) return s.slice(-8000);
    if (err.message) return err.message;
  }
  return e instanceof Error ? e.message : String(e);
}

/**
 * Prefer `npm run build` (tsc + vite). Historic commits may fail tsc (unused locals,
 * strict errors); then retry with `vite build` only so preview + screenshots still work.
 * @param {{ appRoot: string; env: NodeJS.ProcessEnv }} p
 */
async function buildAppBundleForPreview(p) {
  const execOpts = { cwd: p.appRoot, env: p.env, maxBuffer: 50 * 1024 * 1024 };
  if (p.env.FOTONOZA_APP_VITE_BUILD_ONLY === "1") {
    console.log("[pipeline] FOTONOZA_APP_VITE_BUILD_ONLY=1 — running `npx vite build` only");
    await execFileAsync("npx", ["vite", "build"], execOpts);
    console.log("[pipeline] fotonoza-app build: ok (vite only — forced)");
    return;
  }
  try {
    await execFileAsync("npm", ["run", "build"], execOpts);
    console.log("[pipeline] fotonoza-app build: ok (npm run build — tsc + vite)");
    return;
  } catch (firstErr) {
    const firstMsg = formatExecError(firstErr);
    console.warn(
      "[pipeline] npm run build failed (often strict TS on old commits). Retrying with `npx vite build` (skips tsc)…"
    );
    if (firstMsg) console.warn(firstMsg.slice(-4000));
    try {
      await execFileAsync("npx", ["vite", "build"], execOpts);
      console.log("[pipeline] fotonoza-app build: ok (vite only — no tsc)");
    } catch (secondErr) {
      const secondMsg = formatExecError(secondErr);
      throw new Error(
        `fotonoza-app build failed after full build and vite-only retry.\n\n--- npm run build ---\n${firstMsg}\n\n--- npx vite build ---\n${secondMsg}`
      );
    }
  }
}

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
 * @returns {Promise<
 *   | { ok: true; slug: string; pngPath: string; mdPath: string; runId: string; shas: string[] }
 *   | { ok: false; code: "NO_COMMITS"; message: string }
 * >}
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
    return { ok: false, code: "NO_COMMITS", message: msg };
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
      await buildAppBundleForPreview({ appRoot: opts.appRoot, env: buildEnv });
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

  return { ok: true, slug, pngPath, mdPath, runId, shas };
}
