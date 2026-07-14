#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractTrackedReleaseTags,
  planReleaseBatch,
  releaseBranchName,
  releaseTagFromPrTitle,
} from "../lib/release-sync.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

export class GitHubApiError extends Error {
  constructor(message, status, responseBody) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

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
        "User-Agent": "hermes-atlas-release-sync",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new GitHubApiError(
        `${method} ${apiPath} failed (${response.status}): ${data?.message || text}`,
        response.status,
        data,
      );
    }
    return data;
  }
}

function walkMarkdown(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkMarkdown(absolute));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(absolute);
  }
  return files;
}

function readResearchFiles(root = ROOT) {
  return walkMarkdown(path.join(root, "research")).map((absolute) => ({
    path: path.relative(root, absolute).split(path.sep).join("/"),
    content: fs.readFileSync(absolute, "utf-8"),
  }));
}

async function listAllReleases(client) {
  const releases = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await client.request(
      "GET",
      `/repos/NousResearch/hermes-agent/releases?per_page=100&page=${page}`,
    );
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  return releases;
}

async function listOpenPulls(client, repository) {
  return client.request("GET", `/repos/${repository}/pulls?state=open&per_page=100`);
}

async function closeTrackedReleasePrs(client, repository, trackedTags, { excludeNumber } = {}) {
  const pulls = await listOpenPulls(client, repository);
  for (const pr of pulls) {
    if (pr.number === excludeNumber || !pr.head?.ref?.startsWith("release-notes-")) continue;
    const tag = releaseTagFromPrTitle(pr.title);
    if (!tag || !trackedTags.has(tag)) continue;

    await client.request("POST", `/repos/${repository}/issues/${pr.number}/comments`, {
      body: `Auto-closed: ${tag} is already present on main. This release PR is superseded by the synchronized release corpus.`,
    });
    await client.request("PATCH", `/repos/${repository}/pulls/${pr.number}`, { state: "closed" });
    console.log(`Closed superseded release PR #${pr.number} (${tag})`);
  }
  return pulls;
}

async function createOrMoveBranch(client, repository, branch, sha) {
  try {
    await client.request("POST", `/repos/${repository}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha,
    });
  } catch (error) {
    if (!(error instanceof GitHubApiError) || error.status !== 422) throw error;
    await client.request("PATCH", `/repos/${repository}/git/refs/heads/${branch}`, {
      sha,
      force: true,
    });
  }
}

async function waitForMergeability(client, repository, pullNumber) {
  let pull = null;
  for (let attempt = 1; attempt <= 12; attempt++) {
    pull = await client.request("GET", `/repos/${repository}/pulls/${pullNumber}`);
    if (pull.mergeable !== null) return pull;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`PR #${pullNumber} mergeability did not settle (last state: ${pull?.mergeable_state})`);
}

function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) fs.appendFileSync(outputFile, `${name}=${value}\n`);
  console.log(`${name}=${value}`);
}

export async function syncReleases({
  client,
  repository,
  researchFiles = readResearchFiles(),
}) {
  const upstreamReleases = await listAllReleases(client);
  const plan = planReleaseBatch({ upstreamReleases, researchFiles });

  await closeTrackedReleasePrs(client, repository, plan.trackedTags);

  if (plan.documents.length === 0) {
    console.log(`No missing releases (${plan.trackedTags.size} tags already tracked)`);
    setOutput("new_release", "false");
    setOutput("merged", "false");
    return { merged: false, documents: [] };
  }

  const tags = plan.documents.map((document) => document.release.tag_name);
  const latestTag = tags.at(-1);
  console.log(`Missing ${tags.length} release(s): ${tags.join(", ")}`);

  const mainRef = await client.request("GET", `/repos/${repository}/git/ref/heads/main`);
  const baseCommit = await client.request("GET", `/repos/${repository}/git/commits/${mainRef.object.sha}`);

  const tree = [];
  for (const document of plan.documents) {
    const blob = await client.request("POST", `/repos/${repository}/git/blobs`, {
      content: document.content,
      encoding: "utf-8",
    });
    tree.push({ path: document.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const newTree = await client.request("POST", `/repos/${repository}/git/trees`, {
    base_tree: baseCommit.tree.sha,
    tree,
  });
  const commit = await client.request("POST", `/repos/${repository}/git/commits`, {
    message: `Add Hermes Agent release notes: ${tags.join(", ")}`,
    tree: newTree.sha,
    parents: [mainRef.object.sha],
  });

  const branch = releaseBranchName(latestTag);
  const openPulls = await listOpenPulls(client, repository);
  const existingPull = openPulls.find(
    (pr) => pr.head?.ref?.startsWith("release-notes-") && releaseTagFromPrTitle(pr.title) === latestTag,
  );

  if (existingPull) {
    await client.request(
      "PATCH",
      `/repos/${repository}/git/refs/heads/${existingPull.head.ref}`,
      { sha: commit.sha, force: true },
    );
  } else {
    await createOrMoveBranch(client, repository, branch, commit.sha);
  }

  const pull = existingPull || await client.request("POST", `/repos/${repository}/pulls`, {
    title: `New release: Hermes Agent ${latestTag}`,
    body: [
      `Synchronizes ${tags.length} missing Hermes Agent release(s) into the Atlas knowledge base.`,
      "",
      ...plan.documents.map((document) => `- ${document.release.tag_name}: \`${document.path}\``),
      "",
      "This automation merges authoritative upstream release notes, then explicitly dispatches the RAG rebuild.",
    ].join("\n"),
    head: existingPull?.head.ref || branch,
    base: "main",
  });

  const mergeablePull = await waitForMergeability(client, repository, pull.number);
  if (!mergeablePull.mergeable) {
    throw new Error(
      `PR #${pull.number} is not mergeable (state=${mergeablePull.mergeable_state}); leaving it open for the next retry`,
    );
  }

  const merge = await client.request("PUT", `/repos/${repository}/pulls/${pull.number}/merge`, {
    sha: commit.sha,
    merge_method: "merge",
    commit_title: `Ingest Hermes Agent releases through ${latestTag}`,
  });
  if (!merge.merged) {
    throw new Error(`GitHub did not merge PR #${pull.number}: ${merge.message || "unknown reason"}`);
  }

  const nowTracked = new Set([...plan.trackedTags, ...tags]);
  await closeTrackedReleasePrs(client, repository, nowTracked, { excludeNumber: pull.number });

  await client.request(
    "POST",
    `/repos/${repository}/actions/workflows/rebuild-chunks.yml/dispatches`,
    { ref: "main" },
  );

  setOutput("new_release", "true");
  setOutput("merged", "true");
  setOutput("latest_tag", latestTag);
  setOutput("pull_number", pull.number);
  return { merged: true, documents: plan.documents, pullNumber: pull.number };
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token) throw new Error("GITHUB_TOKEN is required");
  if (!repository) throw new Error("GITHUB_REPOSITORY is required");

  await syncReleases({ client: new GitHubClient({ token }), repository });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack || error);
    process.exit(1);
  });
}

export { extractTrackedReleaseTags };
