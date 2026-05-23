/// <reference path="../types.mjs" />
import {
  createPr,
  ghErrorDetail,
  prExists,
  isPrExistsError,
  handlePrError,
} from "./gh.mjs";
import { git, gitHasChanges, gitRemoteHasBranch } from "./git.mjs";

const BRANCH_PREFIX = "reporep/";
const PR_BASE = "master";
const GET_COMMIT_MESSAGE = (slug) => `[RepoRep] ${slug}`;
const PR_BODY = "";

/**
 * @param {string} root
 * @param {string} branch
 */
async function gitPushWithRebase(root, branch) {
  if (await gitRemoteHasBranch(root, branch)) {
    try {
      await git(root, ["pull", "--rebase", "origin", branch]);
      console.log(`[git] rebased onto origin/${branch}`);
    } catch (e) {
      const note = e instanceof Error ? e.message : String(e);
      console.warn("[git] pull --rebase failed:", note);
      try {
        await git(root, ["rebase", "--abort"]);
      } catch {
        /* not in a rebase */
      }
      await git(root, ["push", "--force-with-lease", "-u", "origin", branch]);
      console.warn(
        "[git] pushed with --force-with-lease (rebase had conflicts or could not apply; remote-only commits on this branch may have been dropped)",
      );
      return;
    }
  }
  await git(root, ["push", "-u", "origin", branch]);
}

/**
 * @param {string} root
 * @param {string} branch
 * @param {{ prBase: string; prBody: string; slug: string }} pr
 */
async function maybeOpenPr(root, branch, pr) {
  try {
    if (await prExists(root, branch)) {
      console.log(
        `[git] open PR already exists for branch ${branch}; skip gh pr create`,
      );
      return;
    }
  } catch (e) {
    console.warn(
      "[git] gh pr list failed; will still try gh pr create:",
      e instanceof Error ? e.message : e,
    );
  }

  const pr = await createPr(root, branch, {
    base: pr.prBase,
    body: pr.prBody,
    slug: pr.slug,
  });

  console.log(pr);
}

/**
 * @param {GitPublishParams} p
 * @param {GitPublishProfile} profile
 */
export async function gitCommitPushPr(p, profile) {
  const { websiteRoot, slug } = p;
  const branch = `${profile?.branchPrefix ?? BRANCH_PREFIX}${slug}`;
  const commitMsg = (profile?.commitMessage ?? GET_COMMIT_MESSAGE)(slug);

  console.log(`[git] branch ${branch}`);

  await git(websiteRoot, ["checkout", "-B", branch]);
  await git(websiteRoot, ["add", "src/content/progress", "public/progress"]);

  if ((await gitHasChanges(websiteRoot)) === 0) {
    console.log("[git] nothing to commit (already committed?)");
    return;
  }

  await git(websiteRoot, ["commit", "-m", commitMsg]);
  await gitPushWithRebase(websiteRoot, branch);

  const prBody = (profile?.prBody ?? (() => PR_BODY))(slug);

  try {
    await maybeOpenPr(websiteRoot, branch, {
      prBase: profile?.prBase ?? PR_BASE,
      prBody,
      slug,
    });
  } catch (e) {
    const detail = ghErrorDetail(e);
    if (isPrExistsError(detail)) return;
    handlePrError(detail);
  }
}
