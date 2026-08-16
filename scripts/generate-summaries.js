#!/usr/bin/env node
/**
 * generate-summaries.js
 *
 * Generates LLM-powered original summaries for each repo in the Hermes Atlas
 * ecosystem. Uses README content as source of truth, with SHA-256 hashing for
 * incremental regeneration (only new/changed READMEs trigger LLM calls).
 *
 * Outputs:
 *   - data/summaries.json     (per-repo summaries + highlights)
 *   - data/list-summaries.json (per-list contextual descriptions)
 *
 * Usage: GITHUB_TOKEN=... OPENROUTER_API_KEY=... node scripts/generate-summaries.js
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { githubHeaders, fetchReadme } from "../lib/github.js";
import { callOpenRouterJSON } from "../lib/openrouter.js";
import {
  listSummaryNeedsRegeneration,
  pruneObjectKeys,
  validateListEntries,
} from "../lib/summary-pruning.js";
import { writeJsonCheckpoint } from "../lib/json-checkpoint.js";
import { mapWithConcurrency } from "../lib/bounded-concurrency.js";
import {
  LIST_CHUNK_SIZE,
  chunkList,
  mergeEntryMaps,
  findMissingEntries,
  buildListPrompt,
} from "../lib/list-summary-batching.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

if (!GITHUB_TOKEN) {
  console.error("Error: GITHUB_TOKEN environment variable required");
  process.exit(1);
}
if (!OPENROUTER_KEY) {
  console.error("Error: OPENROUTER_API_KEY environment variable required");
  process.exit(1);
}

const GITHUB_HEADERS = githubHeaders(GITHUB_TOKEN);

// Bump this to force regeneration of all summaries (e.g., after prompt changes)
const SUMMARY_VERSION = 1;

const DELAY_MS = 1500; // Delay between LLM calls to respect rate limits
const SUMMARY_CONCURRENCY = Math.min(
  Math.max(parseInt(process.env.SUMMARY_CONCURRENCY || "3", 10) || 3, 1),
  6,
);

// ── Load data ──
const repos = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "repos.json"), "utf-8")
);

const lists = (() => {
  const p = path.join(ROOT, "data", "lists.json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : [];
})();

const summariesPath = path.join(ROOT, "data", "summaries.json");
const listSummariesPath = path.join(ROOT, "data", "list-summaries.json");

const summaries = (() => {
  try {
    return JSON.parse(fs.readFileSync(summariesPath, "utf-8"));
  } catch {
    return {};
  }
})();

const listSummaries = (() => {
  try {
    return JSON.parse(fs.readFileSync(listSummariesPath, "utf-8"));
  } catch {
    return {};
  }
})();

// ── Helpers ──
function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Basic inline fact-check: extract numbers and proper nouns from the summary
 * and verify they appear in the README.
 */
function factCheck(summary, readme) {
  const readmeLower = readme.toLowerCase();
  const warnings = [];

  // Extract numbers from summary (skip years and common values)
  const numbers = summary.match(/\b\d{2,}\b/g) || [];
  const significantNumbers = numbers.filter(
    (n) => !["2024", "2025", "2026", "100"].includes(n)
  );

  let unmatched = 0;
  for (const num of significantNumbers) {
    if (!readme.includes(num)) {
      warnings.push(`Number "${num}" not found in README`);
      unmatched++;
    }
  }

  if (significantNumbers.length > 0 && unmatched / significantNumbers.length > 0.3) {
    warnings.push("WARNING: >30% of numbers in summary not found in README");
  }

  return warnings;
}

// ── Project summary generation ──
const SYSTEM_PROMPT = `You are a precision technical writer for Hermes Atlas. Write concise summaries of open-source projects using ONLY claims explicitly supported by the supplied README. If a feature, integration, architecture detail, number, or use case is not stated in the README, omit it. Prefer cautious, concrete wording over broad claims. Never infer a technology from file names, badges, dependencies, or a project's category.`;

function buildProjectPrompt(repo, readme) {
  const readmeTruncated = readme.slice(0, 8000);

  return `Write a summary for the GitHub project ${repo.owner}/${repo.repo}.

GitHub description: ${repo.description}
Category: ${repo.category}
Stars: ${repo.stars}

README content (the only factual source — metadata above is context only and must not be repeated unless the README confirms it):
---
${readmeTruncated}
---

${repo.audit === "flagged" ? `Previous draft failed factual audit. Do not repeat any of these unsupported claims:
${repo.auditNotes || "Use only directly stated README claims."}
` : ""}

Output a JSON object with exactly these fields:
- "summary": A 2-3 sentence plain-language summary. State only what the README directly supports. Do not use marketing superlatives.
- "highlights": An array of 1-3 short factual bullet points (under 12 words each). Use fewer bullets if the README is sparse.

Respond with ONLY the JSON object, no markdown fences, no explanation.`;
}

// buildListPrompt + batch chunk/merge helpers now live in
// lib/list-summary-batching.js so they can be unit-tested in isolation.

// ── Main ──
async function main() {
  console.log(
    `Generating summaries for ${repos.length} repos (version ${SUMMARY_VERSION})...\n`
  );

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  const changedRepoKeys = new Set();

  // Prune first and checkpoint immediately. Previously this ran only after
  // every network/LLM call, so a timeout could leave deleted repos in the
  // generated summary store indefinitely.
  const validKeys = new Set(repos.map((r) => `${r.owner}/${r.repo}`));
  const prunedKeys = pruneObjectKeys(summaries, validKeys);
  if (prunedKeys.length > 0) {
    writeJsonCheckpoint(summariesPath, summaries);
    console.log(`Pruned ${prunedKeys.length} orphaned summaries (not in repos.json)`);
  }

  await mapWithConcurrency(repos, SUMMARY_CONCURRENCY, async (repo) => {
    const key = `${repo.owner}/${repo.repo}`;
    const existing = summaries[key];

    // Fetch README
    const readmeRaw = await fetchReadme(repo.owner, repo.repo, GITHUB_HEADERS);
    if (!readmeRaw) {
      console.log(`  ${key}: no README, skipping`);
      skipped++;
      return;
    }

    // Check if regeneration is needed
    const hash = sha256(readmeRaw);
    if (
      existing &&
      existing.readmeHash === hash &&
      existing.version === SUMMARY_VERSION
    ) {
      skipped++;
      return;
    }

    // Generate summary
    console.log(`  ${key}: generating summary...`);
    try {
      const result = await callOpenRouterJSON({
        system: SYSTEM_PROMPT,
        user: buildProjectPrompt(
          { ...repo, audit: existing?.audit, auditNotes: existing?.auditNotes },
          readmeRaw,
        ),
        apiKey: OPENROUTER_KEY,
        maxTokens: 600,
      });

      // Validate structure
      if (!result.summary || typeof result.summary !== "string") {
        throw new Error("Missing or invalid 'summary' field");
      }
      if (
        !Array.isArray(result.highlights) ||
        result.highlights.length < 1
      ) {
        throw new Error("Missing or invalid 'highlights' field");
      }

      // Inline fact-check
      const warnings = factCheck(result.summary, readmeRaw);
      if (warnings.length > 0) {
        console.warn(`    Fact-check warnings for ${key}:`);
        warnings.forEach((w) => console.warn(`      - ${w}`));
      }

      summaries[key] = {
        summary: result.summary,
        highlights: result.highlights.slice(0, 3),
        readmeHash: hash,
        generatedAt: new Date().toISOString(),
        model: "google/gemma-4-31b-it:free",
        version: SUMMARY_VERSION,
        audit: "pass",
      };

      // Checkpoint every successful item so a runner timeout or transient
      // provider outage can resume instead of discarding an entire long run.
      writeJsonCheckpoint(summariesPath, summaries);

      changedRepoKeys.add(key);
      generated++;
    } catch (e) {
      console.error(`    FAILED ${key}: ${e.message}`);
      failed++;
    }

    // Rate limit delay
    await sleep(DELAY_MS);
  });

  // Prune orphaned summaries for repos no longer in the catalog. Without this
  // the file accumulates dead entries (removed/renamed repos), which then leak
  // into llms-full.txt (built by bundling summary content). Removal-only — no
  // generated content, so no hallucination risk.
  // Write summaries
  writeJsonCheckpoint(summariesPath, summaries);
  console.log(
    `\nProject summaries: ${generated} generated, ${skipped} skipped, ${failed} failed\n`
  );

  // ── List summaries ──
  console.log("Generating list summaries...");
  let listsGenerated = 0;
  let listsFailed = 0;

  for (const list of lists) {
    if (list.summaries === false) continue;

    const memberRepos = repos.filter((r) => {
      if (list.filter?.category) return r.category === list.filter.category;
      return false;
    });

    if (memberRepos.length === 0) continue;

    // List summaries are keyed by member repo. Prune removals without an LLM
    // call so a dead catalog entry cannot linger in list prose or generated
    // pages after it has been removed from data/repos.json.
    const memberKeys = new Set(memberRepos.map((r) => `${r.owner}/${r.repo}`));
    const listEntries = listSummaries[list.slug]?.entries;
    const removedEntries = pruneObjectKeys(listEntries, memberKeys);
    if (removedEntries.length > 0) {
      console.log(`  ${list.slug}: pruned ${removedEntries.length} orphaned entries`);
    }

    // Check if any member repo's summary changed
    const needsRegen = listSummaryNeedsRegeneration({
      listSummary: listSummaries[list.slug],
      memberKeys,
      summaries,
      version: SUMMARY_VERSION,
      changedKeys: changedRepoKeys,
    });

    if (!needsRegen) {
      console.log(`  ${list.slug}: up to date, skipping`);
      continue;
    }

    console.log(`  ${list.slug}: generating (${memberRepos.length} projects)...`);
    try {
      // Rank by stars across the whole list, THEN chunk, so chunk membership
      // follows the global star order the single-call prompt used to present.
      // A single call for a large list (e.g. top-skills at 34 repos) asks for
      // more JSON than maxTokens 3200 can emit, truncating the response
      // mid-string; batching keeps every call well under the cap.
      const rankedMembers = memberRepos
        .slice()
        .sort((a, b) => (b.stars || 0) - (a.stars || 0));
      const chunks = chunkList(rankedMembers, LIST_CHUNK_SIZE);
      const chunkMaps = [];
      for (const chunk of chunks) {
        const chunkEntries = await callOpenRouterJSON({
          system: SYSTEM_PROMPT,
          user: buildListPrompt(list, chunk, summaries),
          apiKey: OPENROUTER_KEY,
          maxTokens: 3200,
        });
        chunkMaps.push(chunkEntries);
        if (chunks.length > 1) await sleep(DELAY_MS);
      }
      const entries = mergeEntryMaps(chunkMaps);

      // Fail loud if any member lost its description in a chunk (e.g. a chunk
      // still truncated, or a model dropped a key). Same failure path as a
      // single-call failure: throw -> caught below -> listsFailed++ -> the run
      // throws at the end. The cache is not half-written.
      const missing = findMissingEntries(entries, memberKeys);
      if (missing.length > 0) {
        throw new Error(
          `Missing list descriptions after batching: ${missing.join(", ")}`,
        );
      }

      validateListEntries(entries, memberKeys);

      listSummaries[list.slug] = {
        entries: entries,
        generatedAt: new Date().toISOString(),
        version: SUMMARY_VERSION,
      };

      writeJsonCheckpoint(listSummariesPath, listSummaries);

      listsGenerated++;
    } catch (e) {
      console.error(`    FAILED ${list.slug}: ${e.message}`);
      listsFailed++;
    }

    await sleep(DELAY_MS);
  }

  // Write list summaries
  writeJsonCheckpoint(listSummariesPath, listSummaries);
  console.log(`List summaries: ${listsGenerated} generated\n`);

  if (failed > 0 || listsFailed > 0) {
    throw new Error(
      `Summary generation failed: ${failed} project failures, ${listsFailed} list failures`,
    );
  }

  console.log("Done!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
