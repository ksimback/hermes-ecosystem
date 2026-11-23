// Merge policy: decides who has to sign off on a PR before it lands on main.
//
//   auto   - data, research notes and drafts from a trusted author. Merges once
//            every check is green.
//   review - any other code or page change from a trusted author. Merges once
//            checks are green AND the Claude review (claude-review.yml) posted a
//            passing `ai-review` status on the current head commit.
//   human  - workflows, deploy/CSP config, the LLM client, dependencies, the
//            merge policy itself, catalog deletions, external contributors.
//            Labelled needs-kevin and assigned; never merged automatically.
//
// Pure logic lives here (tested in tests/merge-tiers.test.js). Network I/O is
// in scripts/merge-policy.js, which always runs from main, so a PR cannot
// re-classify itself by editing this file (and editing it is human tier).

export const TIERS = { auto: "auto", review: "review", human: "human" };

export const LABELS = {
  auto: "tier:auto",
  review: "tier:review",
  human: "tier:human",
  needsKevin: "needs-kevin",
  hold: "hold",
};

export const REVIEW_STATUS = "ai-review";
export const REQUIRED_CHECK = "test";

const HUMAN_PATHS = [
  [/^\.github\//, "workflows and repo automation"],
  [/^vercel\.json$/, "deploy config / CSP"],
  [/^lib\/llm\.js$/, "LLM client"],
  [/^package(-lock)?\.json$/, "dependencies"],
  [/^lib\/merge-tiers\.js$|^scripts\/merge-policy\.js$/, "the merge policy itself"],
  [/(^|\/)\.env|\.pem$|\.key$/, "possible secret file"],
];

const AUTO_PATHS = [/^data\//, /^research\//, /^drafts\//];

// GitHub only lists the first 300 files of a PR, and path-filtered checks can
// skip on larger diffs, so nothing that big is merged without a human.
export const MAX_FILES = 300;

/**
 * Catalog entries present on the base branch but missing from the head.
 * base/head: parsed data/repos.json arrays (null when the file is absent).
 */
export function catalogDeletions(base, head) {
  if (!Array.isArray(base)) return [];
  const key = (r) => `${r.owner}/${r.repo}`.toLowerCase();
  const kept = new Set((Array.isArray(head) ? head : []).map(key));
  return base.map(key).filter((k) => !kept.has(k));
}

/**
 * files: [{ filename, status, previous_filename? }] from the PR files API.
 * Returns { tier, reasons } (reasons explain a human tier).
 */
export function classifyPr({ files, author, isFork, trustedAuthors, deletions = [] }) {
  const reasons = [];
  if (isFork) reasons.push("external contributor (fork)");
  else if (!trustedAuthors.includes(author)) reasons.push(`author ${author} is not in TRUSTED_PR_AUTHORS`);
  if (files.length >= MAX_FILES) reasons.push(`${files.length} files (limit ${MAX_FILES - 1})`);

  for (const f of files) {
    for (const path of [f.filename, f.previous_filename].filter(Boolean)) {
      const hit = HUMAN_PATHS.find(([re]) => re.test(path));
      if (hit) reasons.push(`${path}: ${hit[1]}`);
    }
    if (f.status === "removed" && f.filename.startsWith("data/")) reasons.push(`${f.filename}: data file deleted`);
  }
  if (deletions.length) reasons.push(`removes catalog entries: ${deletions.slice(0, 10).join(", ")}${deletions.length > 10 ? ", ..." : ""}`);

  if (reasons.length) return { tier: TIERS.human, reasons: [...new Set(reasons)] };
  const auto = files.length > 0 && files.every((f) => AUTO_PATHS.some((re) => re.test(f.filename)));
  return { tier: auto ? TIERS.auto : TIERS.review, reasons: [] };
}

const PASSING = new Set(["success", "neutral", "skipped"]);

/**
 * Whether a classified PR can be merged now.
 * checkRuns: [{ name, status, conclusion }] for the head commit.
 * statuses: latest commit status per context [{ context, state }].
 * ignoreChecks: check names to leave out (the policy's own job).
 * Returns { ready, state: "ready" | "waiting" | "blocked", reason }.
 */
export function mergeReadiness({ pr, tier, checkRuns, statuses, ignoreChecks = [] }) {
  const wait = (reason) => ({ ready: false, state: "waiting", reason });
  const block = (reason) => ({ ready: false, state: "blocked", reason });

  if (tier === TIERS.human) return block("needs Kevin");
  if (pr.draft) return block("draft");
  if (pr.labels.some((l) => l.name === LABELS.hold)) return block(`labelled ${LABELS.hold}`);
  if (pr.mergeable === false) return block("merge conflict with main");
  if (pr.mergeable == null) return wait("GitHub is still computing mergeability");

  const runs = checkRuns.filter((r) => !ignoreChecks.includes(r.name));
  const test = runs.find((r) => r.name === REQUIRED_CHECK);
  if (!test) return wait(`required check "${REQUIRED_CHECK}" has not started`);
  const pending = runs.filter((r) => r.status !== "completed");
  if (pending.length) return wait(`checks running: ${pending.map((r) => r.name).join(", ")}`);
  const failing = runs.filter((r) => !PASSING.has(r.conclusion));
  if (failing.length) return block(`checks failing: ${failing.map((r) => r.name).join(", ")}`);

  const others = statuses.filter((s) => s.context !== REVIEW_STATUS);
  const otherPending = others.filter((s) => s.state === "pending");
  if (otherPending.length) return wait(`statuses pending: ${otherPending.map((s) => s.context).join(", ")}`);
  const otherFailing = others.filter((s) => s.state !== "success");
  if (otherFailing.length) return block(`statuses failing: ${otherFailing.map((s) => s.context).join(", ")}`);

  if (tier === TIERS.review) {
    const review = statuses.find((s) => s.context === REVIEW_STATUS);
    if (!review || review.state === "pending") return wait("waiting for the Claude review of this commit");
    if (review.state !== "success") return block(`Claude review: ${review.description || review.state}`);
  }
  return { ready: true, state: "ready", reason: "all checks green" };
}

// GitHub skips push workflows when the head commit message carries a skip
// marker anywhere. A merged PR must trigger the normal rebuilds, so strip them.
const SKIP_MARKERS = /\[(skip ci|ci skip|no ci|skip actions|actions skip)\]|\*\*\*NO_CI\*\*\*/gi;

export function mergeCommit(pr, tier) {
  const title = `${pr.title.replace(SKIP_MARKERS, "").replace(/\s+/g, " ").trim()} (#${pr.number})`;
  return { commit_title: title, commit_message: `Merged by the merge policy (${tier} tier).` };
}
