#!/usr/bin/env node
// Sync the demand-side corpus: real community stories about what people build
// with Hermes Agent. Nous publishes these as a canonical JSON file that backs
// https://hermes-agent.nousresearch.com/docs/user-stories — we mirror it into
// data/user-stories.json so the use-case recommender can cite real posts
// instead of inventing marketing use cases.
//
// data/use-cases.json references stories by `id` only (never by copied quote),
// so a refresh that drops or renames a story surfaces as a validator failure
// rather than a page quoting text that no longer exists upstream.
//
// Usage: node scripts/sync-user-stories.js [--dry-run]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

export const SOURCE_URL =
  "https://raw.githubusercontent.com/NousResearch/hermes-agent/main/website/src/data/userStories.json";
export const SOURCE_HUMAN_URL =
  "https://github.com/NousResearch/hermes-agent/blob/main/website/src/data/userStories.json";
export const PUBLISHED_URL = "https://hermes-agent.nousresearch.com/docs/user-stories";
export const LICENSE = "MIT © Nous Research";

const OUTPUT_PATH = path.join(ROOT, "data", "user-stories.json");

const REQUIRED_FIELDS = ["id", "source", "url", "category", "headline"];

// Upstream is a hand-curated file in someone else's repo. If it ever gets
// restructured, refactored into per-category files, or truncated mid-edit, a
// silent partial sync would quietly strip evidence off every use-case page.
// Refuse to overwrite on a large drop and make the human look.
export const MIN_STORIES = 50;
export const MAX_SHRINK_RATIO = 0.2;

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateStories(stories) {
  const errors = [];

  if (!Array.isArray(stories)) {
    return ["upstream payload must be a top-level array"];
  }
  if (stories.length < MIN_STORIES) {
    errors.push(`only ${stories.length} stories upstream (expected at least ${MIN_STORIES})`);
  }

  const seen = new Set();
  stories.forEach((story, index) => {
    const label = `[${index}]`;
    if (!story || typeof story !== "object" || Array.isArray(story)) {
      errors.push(`${label} entry must be an object`);
      return;
    }
    for (const field of REQUIRED_FIELDS) {
      if (!isNonEmptyString(story[field])) {
        errors.push(`${label} missing or empty required field: ${field}`);
      }
    }
    if (isNonEmptyString(story.id)) {
      if (seen.has(story.id)) errors.push(`${label} duplicate story id: ${story.id}`);
      else seen.add(story.id);
    }
    // Evidence tiles link straight out to the cited post. Anything that isn't
    // a plain http(s) URL would end up rendered as an anchor href.
    if (isNonEmptyString(story.url) && !/^https?:\/\//i.test(story.url)) {
      errors.push(`${label} url must be http(s): ${story.url}`);
    }
  });

  return errors;
}

export function diffStoryIds(previousStories, nextStories) {
  const before = new Set((previousStories || []).map((s) => s.id));
  const after = new Set((nextStories || []).map((s) => s.id));
  return {
    added: [...after].filter((id) => !before.has(id)).sort(),
    removed: [...before].filter((id) => !after.has(id)).sort(),
  };
}

export function readExistingCorpus(filePath = OUTPUT_PATH) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(parsed?.stories) ? parsed : null;
  } catch {
    return null;
  }
}

export function assertNoSuspiciousShrink(previous, next) {
  if (!previous || !Array.isArray(previous.stories) || previous.stories.length === 0) return;
  const before = previous.stories.length;
  const after = next.length;
  if (after < before * (1 - MAX_SHRINK_RATIO)) {
    throw new Error(
      `Upstream story count dropped from ${before} to ${after} ` +
      `(more than ${Math.round(MAX_SHRINK_RATIO * 100)}%). Refusing to overwrite ` +
      `data/user-stories.json — check ${SOURCE_HUMAN_URL} before re-running.`
    );
  }
}

export function buildCorpusFile(stories, { fetchedAt }) {
  return {
    source: SOURCE_HUMAN_URL,
    published: PUBLISHED_URL,
    license: LICENSE,
    fetchedAt,
    count: stories.length,
    stories,
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log(`Fetching user stories from ${SOURCE_URL} ...`);
  const response = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "hermes-atlas-user-stories-sync" },
  });
  if (!response.ok) {
    throw new Error(`Upstream fetch failed: HTTP ${response.status} ${response.statusText}`);
  }

  const stories = await response.json();
  const errors = validateStories(stories);
  if (errors.length > 0) {
    console.error("Upstream user-stories payload failed validation:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  const previous = readExistingCorpus();
  assertNoSuspiciousShrink(previous, stories);

  const { added, removed } = diffStoryIds(previous?.stories, stories);
  console.log(`  ${stories.length} stories (+${added.length} / -${removed.length})`);
  for (const id of added) console.log(`    + ${id}`);
  for (const id of removed) console.log(`    - ${id}`);
  if (removed.length > 0) {
    console.log(
      "\n  Removed ids may be cited in data/use-cases.json — " +
      "run `node scripts/validate-use-cases.js` next."
    );
  }

  const byCategory = stories.reduce((acc, s) => ((acc[s.category] = (acc[s.category] || 0) + 1), acc), {});
  console.log(`  categories: ${Object.entries(byCategory).map(([k, v]) => `${k}=${v}`).join(", ")}`);

  if (dryRun) {
    console.log("\n--dry-run: not writing data/user-stories.json");
    return;
  }

  // Match the repo's existing generated-data convention: 2-space JSON with a
  // trailing newline, preserving the file's existing line endings so a refresh
  // doesn't churn the whole diff.
  const existingText = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, "utf8") : "";
  const eol = existingText.includes("\r\n") ? "\r\n" : "\n";
  const fetchedAt = new Date().toISOString().slice(0, 10);
  const body =
    JSON.stringify(buildCorpusFile(stories, { fetchedAt }), null, 2).replace(/\n/g, eol) + eol;
  fs.writeFileSync(OUTPUT_PATH, body);
  console.log(`\nWrote data/user-stories.json (${stories.length} stories, fetchedAt ${fetchedAt})`);
}

// Windows-safe entry check — see scripts/validate-repos-json.js:176
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}
