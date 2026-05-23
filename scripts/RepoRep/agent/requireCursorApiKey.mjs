export function requireCursorApiKey() {
  if (!process.env.CURSOR_API_KEY?.trim()) {
    console.error("Missing CURSOR_API_KEY (set in environment or .env)");
    process.exit(1);
  }
}
