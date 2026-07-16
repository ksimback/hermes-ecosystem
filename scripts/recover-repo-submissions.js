#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findSubmissionCandidate,
  mergeSubmissionCandidate,
  repoKey,
} from "../lib/repo-submission.js";

export class GitHubClient {
  constructor({ token, fetchImpl = fetch }) {
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  async request(method, apiPath, body) {
    const response = await this.fetchImpl(`https://api.github.com${apiPath}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "User-Agent": "hermes-atlas-repo-recovery",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const error = new Error(`${method} ${apiPath} failed (${response.status}): ${data?.message || text}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }
}

function decodeJsonFile(file) {
  return JSON.parse(Buffer.from(file.content, "base64").toString("utf-8"));
}

async function getReposFile(client, repository, ref) {
  return client.request(
    "GET",
    `/repos/${repository}/contents/data/repos.json?ref=${encodeURIComponent(ref)}`,
  );
}

async function waitForMergeability(client, repository, pullNumber) {
  let pull = null;
  for (let attempt = 1; attempt <= 12; attempt++) {
    pull = await client.request("GET", `/repos/${repository}/pulls/${pullNumber}`);
    if (pull.mergeable !== null) return pull;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`PR #${pullNumber} mergeability did not settle (state=${pull?.mergeable_state})`);
}

async function comment(client, repository, issueNumber, body) {
  await client.request("POST", `/repos/${repository}/issues/${issueNumber}/comments`, { body });
}

function trackerTitle(pullNumber) {
  return `[Workflow] Validator PR #${pullNumber} needs manual review`;
}

async function refreshSubmissionBranch({
  client,
  repository,
  pull,
  mainSha,
  mainTreeSha,
  nextRepos,
}) {
  const blob = await client.request("POST", `/repos/${repository}/git/blobs`, {
    content: `${JSON.stringify(nextRepos, null, 2)}\n`,
    encoding: "utf-8",
  });
  const tree = await client.request("POST", `/repos/${repository}/git/trees`, {
    base_tree: mainTreeSha,
    tree: [{
      path: "data/repos.json",
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    }],
  });
  const commit = await client.request("POST", `/repos/${repository}/git/commits`, {
    message: `Refresh validator PR #${pull.number} onto latest main`,
    tree: tree.sha,
    parents: [mainSha],
  });
  await client.request(
    "PATCH",
    `/repos/${repository}/git/refs/heads/${pull.head.ref}`,
    { sha: commit.sha, force: true },
  );
  return commit.sha;
}

function repoKeyFromText(text) {
  const match = String(text || "").match(
    /https:\/\/github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/,
  );
  return match ? match[1].replace(/\/$/, "").toLowerCase() : "";
}

function expectedRepoKey(pull) {
  const key = repoKeyFromText(pull.body);
  if (!key) {
    throw new Error("Could not identify the submitted repository from the PR body");
  }
  return key;
}

async function closeSuggestion(client, repository, issue, body, stateReason) {
  await comment(client, repository, issue.number, body);
  await client.request("PATCH", `/repos/${repository}/issues/${issue.number}`, {
    state: "closed",
    state_reason: stateReason,
  });
}

async function reconcileSuggestionIssues(client, repository, suggestionIssues) {
  if (suggestionIssues.length === 0) return;
  const mainFile = await getReposFile(client, repository, "main");
  const catalogKeys = new Set(decodeJsonFile(mainFile).map(repoKey));

  for (const issue of suggestionIssues) {
    const key = repoKeyFromText(issue.body);
    if (!key) continue;
    if (catalogKeys.has(key)) {
      await closeSuggestion(
        client,
        repository,
        issue,
        `Auto-closed: ${key} is present in the current Atlas catalog.`,
        "completed",
      );
      continue;
    }

    try {
      await client.request("GET", `/repos/${key}`);
    } catch (error) {
      if (error.status !== 404) throw error;
      await closeSuggestion(
        client,
        repository,
        issue,
        `Auto-closed: https://github.com/${key} no longer exists (GitHub returned 404).`,
        "not_planned",
      );
    }
  }
}

async function closeTracker(client, repository, tracker) {
  if (!tracker) return;
  await comment(client, repository, tracker.number, "Recovered automatically; the validator PR is no longer blocked.");
  await client.request("PATCH", `/repos/${repository}/issues/${tracker.number}`, {
    state: "closed",
    state_reason: "completed",
  });
}

async function ensureTracker(client, repository, trackers, pull, reason) {
  const title = trackerTitle(pull.number);
  const existing = trackers.get(title);
  const body = `Validator recovery could not merge PR #${pull.number}.\n\n**Reason:** \`${reason}\`\n\nThe recovery job will retry on its next run.`;
  if (existing) {
    await comment(client, repository, existing.number, body);
    return;
  }
  const issue = await client.request("POST", `/repos/${repository}/issues`, {
    title,
    body,
    labels: ["workflow-issue"],
  });
  trackers.set(title, issue);
}

export async function recoverRepoSubmissions({ client, repository }) {
  const [allPulls, issueList, suggestionIssues] = await Promise.all([
    client.request("GET", `/repos/${repository}/pulls?state=open&per_page=100`),
    client.request("GET", `/repos/${repository}/issues?state=open&labels=workflow-issue&per_page=100`),
    client.request("GET", `/repos/${repository}/issues?state=open&labels=repo-suggestion&per_page=100`),
  ]);
  const pulls = allPulls
    .filter((pull) => pull.head?.ref?.startsWith("add-repo-"))
    .filter((pull) => pull.head?.repo?.full_name === repository)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const trackers = new Map(issueList.map((issue) => [issue.title, issue]));
  const failures = [];
  let mergedCount = 0;

  for (const pull of pulls) {
    try {
      const files = await client.request(
        "GET",
        `/repos/${repository}/pulls/${pull.number}/files?per_page=100`,
      );
      if (files.length !== 1 || files[0].filename !== "data/repos.json") {
        throw new Error(`PR changes unexpected files: ${files.map((file) => file.filename).join(", ")}`);
      }

      const mainRef = await client.request("GET", `/repos/${repository}/git/ref/heads/main`);
      const mainSha = mainRef.object.sha;
      const [mainCommit, mainFile, branchFile] = await Promise.all([
        client.request("GET", `/repos/${repository}/git/commits/${mainSha}`),
        getReposFile(client, repository, mainSha),
        getReposFile(client, repository, pull.head.ref),
      ]);
      const mainRepos = decodeJsonFile(mainFile);
      const branchRepos = decodeJsonFile(branchFile);
      // Old validator branches can contain a legitimate entry that was later
      // removed from main. That makes a raw branch-vs-main diff contain more
      // than one addition. Select the repository named by the bot-authored PR
      // body, then rebuild the branch from current main so historical baggage
      // cannot be reintroduced.
      const candidate = findSubmissionCandidate(
        mainRepos,
        branchRepos,
        expectedRepoKey(pull),
      );

      if (!candidate) {
        await comment(client, repository, pull.number, "Auto-closing: this repo is already present on main.");
        await client.request("PATCH", `/repos/${repository}/pulls/${pull.number}`, { state: "closed" });
        await closeTracker(client, repository, trackers.get(trackerTitle(pull.number)));
        continue;
      }

      const nextRepos = mergeSubmissionCandidate(mainRepos, candidate);
      await refreshSubmissionBranch({
        client,
        repository,
        pull,
        mainSha,
        mainTreeSha: mainCommit.tree.sha,
        nextRepos,
      });

      const mergeable = await waitForMergeability(client, repository, pull.number);
      if (!mergeable.mergeable) {
        throw new Error(`PR is not mergeable after refresh (state=${mergeable.mergeable_state})`);
      }
      const merge = await client.request("PUT", `/repos/${repository}/pulls/${pull.number}/merge`, {
        sha: mergeable.head.sha,
        merge_method: "squash",
        commit_title: `Add ${candidate.owner}/${candidate.repo} to Atlas ecosystem (#${pull.number})`,
      });
      if (!merge.merged) throw new Error(merge.message || "GitHub declined the merge");

      mergedCount++;
      await closeTracker(client, repository, trackers.get(trackerTitle(pull.number)));
      console.log(`Recovered and merged PR #${pull.number}: ${repoKey(candidate)}`);
    } catch (error) {
      failures.push(`#${pull.number}: ${error.message}`);
      await ensureTracker(client, repository, trackers, pull, error.message);
    }
  }

  // Close tracker issues for PRs that are no longer open (for example #507).
  const openNumbers = new Set(pulls.map((pull) => pull.number));
  for (const issue of trackers.values()) {
    const pullNumber = Number(issue.title.match(/^\[Workflow\] Validator PR #(\d+)/)?.[1]);
    if (pullNumber && !openNumbers.has(pullNumber)) {
      await closeTracker(client, repository, issue);
    }
  }

  await reconcileSuggestionIssues(client, repository, suggestionIssues);

  if (mergedCount > 0) {
    await client.request(
      "POST",
      `/repos/${repository}/actions/workflows/build-pages.yml/dispatches`,
      { ref: "main" },
    );
  }
  if (failures.length > 0) {
    throw new Error(`Repo-submission recovery incomplete:\n${failures.join("\n")}`);
  }

  console.log(`Repo-submission recovery complete: ${mergedCount} merged`);
  return { mergedCount };
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token) throw new Error("GITHUB_TOKEN is required");
  if (!repository) throw new Error("GITHUB_REPOSITORY is required");
  await recoverRepoSubmissions({ client: new GitHubClient({ token }), repository });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack || error);
    process.exit(1);
  });
}
