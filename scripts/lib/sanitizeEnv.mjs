/** Env keys to strip before spawning preview / browser-only children. */
const KEYS_TO_STRIP = [
  "CURSOR_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "FOTONOZA_APP_GIT_URL",
  "FOTONOZA_GIT_URL"
];

export function sanitizedProcessEnv() {
  const out = { ...process.env };
  for (const k of KEYS_TO_STRIP) {
    delete out[k];
  }
  return out;
}
