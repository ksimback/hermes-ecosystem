import {
  CANONICAL_CATEGORIES,
  validateRepos,
} from "../scripts/validate-repos-json.js";

export function repoKey(repo) {
  return `${repo?.owner || ""}/${repo?.repo || ""}`.toLowerCase();
}

export function findSubmissionCandidate(mainRepos, branchRepos) {
  const mainKeys = new Set(mainRepos.map(repoKey));
  const additions = branchRepos.filter((repo) => !mainKeys.has(repoKey(repo)));
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
