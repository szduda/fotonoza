# fotonoza

Marketing site for the **fotonoza** photo editor (Astro). Progress diary posts can be generated from **fotonoza-app** git history via `npm run backfill` / `npm run progress:ci` and GitHub Actions (see `.github/workflows/progress-generate.yml`).

## AI usage (progress post generation)

Automated progress posts call the Cursor Cloud Agent with a **fixed instruction template** plus **one dynamic block** assembled from the private **fotonoza-app** clone (not from this repo’s working tree).

**Dynamic content in the user message (everything except the hardcoded template in `scripts/lib/buildPrompt.mjs`):**

- **Commit list for the batch** — each line is the first **7 characters of the commit SHA** and the **subject line** (first line of the commit message), from `git log -1 --format=%s` run in **fotonoza-app** for each selected commit (`scripts/lib/gitCommitsInRange.mjs` → `formatGitPayload`).
- **Per-commit change statistics** — for each of those SHAs, the output of `git show --stat --format=` in **fotonoza-app** (files touched and insert/delete counts). This is **not** a full unified diff and does **not** include full file contents.

**How those commits are chosen (feeds `gitPayload`, but not pasted as separate range text):**

- **UTC time window** — only commits whose **author date** falls **inclusively** between the run’s start and end instants are included. Commits are read from **current `HEAD` history** in the fotonoza-app checkout (`git log --format=%H %at --reverse HEAD`, then filtered by Unix author time in `listCommitsByAuthorDateInRange`).
- The **yyMMddHHmm** range tokens passed into `buildProgressPrompt` today are **not** interpolated into the prompt string; they only drive which SHAs appear in the block above.

**Not used as prompt input today:** diffs between arbitrary refs, full `git diff` between dates, commit bodies beyond the subject line, fotonoza marketing repo file contents, or screenshots.
