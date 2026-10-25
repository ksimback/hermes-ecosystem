import {
  CANONICAL_CATEGORIES,
  validateRepos,
} from "../scripts/validate-repos-json.js";

export function repoKey(repo) {
  return `${repo?.owner || ""}/${repo?.repo || ""}`.toLowerCase();
}

export function findSubmissionCandidate(mainRepos, branchRepos, expectedKey = "") {
  const mainKeys = new Set(mainRepos.map(repoKey));
  const additions = branchRepos.filter((repo) => !mainKeys.has(repoKey(repo)));

  if (expectedKey) {
    const normalizedExpected = expectedKey.toLowerCase();
    const expected = additions.find((repo) => repoKey(repo) === normalizedExpected);
    if (expected) return expected;
    if (mainKeys.has(normalizedExpected)) return null;
    throw new Error(
      `Expected submission ${expectedKey} was not present in the PR branch; ` +
      `branch-only entries: ${additions.map(repoKey).join(", ") || "none"}`,
    );
  }

  if (additions.length > 1) {
    throw new Error(`Expected one repo addition, found ${additions.length}`);
  }
  return additions[0] || null;
}

export function mergeSubmissionCandidate(mainRepos, candidate) {
  if (!candidate) return [...mainRepos];
  const normalizedCandidate = normalizeSubmissionCandidate(candidate);
  const key = repoKey(normalizedCandidate);
  if (mainRepos.some((repo) => repoKey(repo) === key)) return [...mainRepos];

  const next = [...mainRepos, normalizedCandidate];
  const errors = validateRepos(next);
  if (errors.length > 0) {
    throw new Error(`Candidate repos.json is invalid:\n${errors.join("\n")}`);
  }
  return next;
}

export function normalizeSubmissionCandidate(candidate) {
  const rawCategory = String(candidate?.category || "").trim();
  const canonicalCategory = CANONICAL_CATEGORIES.find(
    (category) => rawCategory === category || rawCategory.startsWith(`${category} `),
  );
  return canonicalCategory && canonicalCategory !== rawCategory
    ? { ...candidate, category: canonicalCategory }
    : { ...candidate };
}

// Entries a PR branch added relative to the commit it forked from. Diffing
// against the merge-base (not current main) matters for stale fork PRs: an
// entry main removed after the fork point is still on the branch, and a
// branch-vs-main diff would resurrect it as an "addition".
export function findBranchAdditions(baseRepos, branchRepos) {
  const baseKeys = new Set(baseRepos.map(repoKey));
  return branchRepos.filter((repo) => !baseKeys.has(repoKey(repo)));
}
