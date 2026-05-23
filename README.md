# fotonoza

Marketing site for the **fotonoza** photo editor (Astro). Progress diary posts can be generated from **fotonoza-app** git history via `npm run reporep:local` / `npm run reporep:ci` and GitHub Actions (see `.github/workflows/progress-generate.yml`).

## AI usage (progress post generation)

Automated progress posts use a **two-turn** Cursor agent (`Agent.create` + two `send` calls) with context from the private **fotonoza-app** clone (not from this repo’s working tree).

**Turn 1 — technical context** (`scripts/RepoRep/agent/buildDiffSummaryPrompt.mjs`):

- Full commit messages (author text, trailers stripped) and per-commit stats from `scripts/RepoRep/git/gitPayload.mjs` (`formatGitPayload`).
- Aggregated unified diff across the batch from `collectAggregatedDiff` (size-capped).

**Turn 2 — article JSON** (`scripts/RepoRep/agent/buildPrompt.mjs`):

- The ~50–200 word summary from turn 1, plus the same git payload, to produce EN/PL post fields.
- `changeSummary` frontmatter on the written markdown matches the turn-1 summary.

**How those commits are chosen (feeds `gitPayload`, but not pasted as separate range text):**

- **UTC time window** — only commits whose **author date** falls **inclusively** between the run’s start and end instants are included. Commits are read from **current `HEAD` history** in the fotonoza-app checkout (`git log --format=%H %at --reverse HEAD`, then filtered by Unix author time in `listCommitsInRange`).
- The **yyMMddHHmm** range tokens are **not** interpolated into prompts; they only select which commits (and thus which messages/diffs) appear above.

**Not used as prompt input:** diffs between arbitrary refs, fotonoza marketing repo file contents, or screenshots.
