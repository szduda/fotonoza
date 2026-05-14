import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Root of the fotonoza marketing repo (contains package.json, src/, public/). */
export function getFotonozaRoot() {
  if (process.env.VERCEL) {
    return process.cwd();
  }
  return resolve(__dirname, "../..");
}

/**
 * Resolve fotonoza-app checkout: `FOTONOZA_APP_ROOT`, else sibling `../fotonoza-app`.
 * @param {string} [override]
 */
export function resolveAppRoot(override) {
  const fromEnv = override ?? process.env.FOTONOZA_APP_ROOT;
  if (fromEnv) {
    const abs = resolve(fromEnv);
    if (!existsSync(join(abs, "package.json"))) {
      throw new Error(`FOTONOZA_APP_ROOT is set but missing package.json: ${abs}`);
    }
    return abs;
  }
  const sibling = resolve(getFotonozaRoot(), "../fotonoza-app");
  if (!existsSync(join(sibling, "package.json"))) {
    throw new Error(
      `Could not find fotonoza-app. Clone it next to fotonoza or set FOTONOZA_APP_ROOT.\n` +
        `  Tried: ${sibling}`
    );
  }
  return sibling;
}
