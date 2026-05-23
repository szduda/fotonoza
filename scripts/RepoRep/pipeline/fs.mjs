/// <reference path="../types.mjs" />
import { access, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const APP_DIR = "fotonoza-app";
const REPOREP_PAYLOAD_FILE = "reporep-payload.txt";

/** Root of the fotonoza marketing repo (contains package.json, src/, public/). */
export function getWebsiteRoot() {
  return resolve(__dirname, "../../..");
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function exitIfNoAppRoot(appRoot) {
  if (!(await pathExists(join(appRoot, "package.json")))) {
    console.error(
      `Missing app at ${appRoot} (clone into repo root before running CI progress).`,
    );
    process.exit(1);
  }
}

export async function resolveAppRoots() {
  const websiteRoot = getWebsiteRoot();
  const appRoot = join(websiteRoot, APP_DIR);
  await exitIfNoAppRoot(appRoot);
  return { websiteRoot, appRoot };
}

/**
 * Write reporep payload for CI artifact upload.
 * @param {PersistGitPayloadOpts} opts
 */
export async function persistGitPayload({ gitPayload }) {
  const websiteRoot = getWebsiteRoot();
  const payloadPath = join(websiteRoot, REPOREP_PAYLOAD_FILE);
  await writeFile(payloadPath, gitPayload, "utf8");
  console.log(`[RepoRep] wrote git payload to ${payloadPath}`);
}

export async function exitIfContentFilesExist({ slug }) {
  const allExist = (
    await Promise.all(
      ["en", "pl"].map((locale) => pathExists(getMdPath(locale, slug))),
    )
  ).every(Boolean);

  if (allExist) {
    console.log(
      `[RepoRep] EN+PL posts already exist (${slug}); skip generation and git.`,
    );
    process.exit(0);
  }
}

export function getMdPath(locale, slug) {
  const websiteRoot = getWebsiteRoot();
  return join(websiteRoot, "src", "content", "progress", locale, `${slug}.md`);
}
