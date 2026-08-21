import { execFileSync } from "child_process";

// build-pages.js refreshes facts and dates in these hand-authored pages. Keep
// the targets here so the generator and the staging manifest cannot drift.
export const REFRESHED_CONTENT_PATHS = [
  "guide/index.html",
  "guide/install/index.html",
  "guide/memory/index.html",
  "guide/vs-claude-code/index.html",
  "drafts/handbook-hub.md",
  "drafts/handbook-vs-claude-code.md",
  "drafts/guide-memory.md",
];

export const GENERATED_ARTIFACT_PATHS = [
  "index.html",
  "404.html",
  ...REFRESHED_CONTENT_PATHS,
  "dev/",
  "privacy/",
  "masterclass/",
  "projects/",
  "lists/",
  "use-cases/",
  "skills/",
  "reports/",
  "sitemap.xml",
  "robots.txt",
  "llms.txt",
  "llms-full.txt",
  "rss.xml",
  "data/repos.json",
  "data/use-cases.json",
  "data/user-stories.json",
  "data/summaries.json",
  "data/list-summaries.json",
  "data/latest-release.json",
];

export function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

export function parsePorcelainStatus(output) {
  return String(output || "")
    .split("\n")
    .filter(Boolean)
    .map((line) => ({
      raw: line,
      index: line.slice(0, 1),
      worktree: line.slice(1, 2),
      path: line.slice(3),
    }));
}

export function isUnstaged(entry) {
  return entry.index === "?" || entry.worktree !== " ";
}

export function assertNoUnstagedChanges({ cwd = process.cwd(), statusOutput } = {}) {
  const output = statusOutput ?? git(["status", "--porcelain"], { cwd });
  const leftovers = parsePorcelainStatus(output).filter(isUnstaged);

  if (leftovers.length > 0) {
    const details = leftovers.map((entry) => `  ${entry.raw}`).join("\n");
    throw new Error(
      "Unstaged files remain after staging generated artifacts. " +
      "If build-pages or generate-summaries emits a new artifact, add it to " +
      "GENERATED_ARTIFACT_PATHS in lib/build-artifacts.js so CI commits it intentionally.\n" +
      details
    );
  }
}

export function stageGeneratedArtifacts({ cwd = process.cwd(), paths = GENERATED_ARTIFACT_PATHS } = {}) {
  git(["add", "--", ...paths], { cwd });
  assertNoUnstagedChanges({ cwd });
}
