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
 * Usage: GITHUB_TOKEN=... NOUS_API_KEY=... node scripts/generate-summaries.js
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { githubHeaders, fetchReadme } from "../lib/github.js";
import { callLLMJSON, LLM_API_KEY, PRIMARY_MODEL } from "../lib/llm.js";
import {
  listMembersNeedingEntries,
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
  pickSingleEntry,
  buildListPrompt,
} from "../lib/list-summary-batching.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error("Error: GITHUB_TOKEN environment variable required");
  process.exit(1);
}
if (!LLM_API_KEY) {
  console.error("Error: NOUS_API_KEY environment variable required");
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
      const result = await callLLMJSON({
        system: SYSTEM_PROMPT,
        user: buildProjectPrompt(
          { ...repo, audit: existing?.audit, auditNotes: existing?.auditNotes },
          readmeRaw,
        ),
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
        model: PRIMARY_MODEL,
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

    // Regenerate only the members whose entry is missing or stale; every
    // other entry is kept verbatim (#958). A full pass only on a new list or
    // a SUMMARY_VERSION bump.
    const { full, keys: staleKeys } = listMembersNeedingEntries({
      listSummary: listSummaries[list.slug],
      memberKeys,
      summaries,
      version: SUMMARY_VERSION,
      changedKeys: changedRepoKeys,
    });

    if (staleKeys.length === 0) {
      console.log(`  ${list.slug}: up to date, skipping`);
      continue;
    }

    const staleSet = new Set(staleKeys);
    const keptEntries = full
      ? {}
      : Object.fromEntries(
          Object.entries(listEntries || {}).filter(([key]) => !staleSet.has(key)),
        );
    console.log(
      `  ${list.slug}: generating ${staleKeys.length}/${memberRepos.length} entries` +
        (full ? " (full pass)..." : ", keeping the rest..."),
    );
    try {
      // Rank by stars across the whole list, THEN chunk, so chunk membership
      // follows the global star order the single-call prompt used to present.
      // A single call for a large list (e.g. top-skills at 34 repos) asks for
      // more JSON than maxTokens 3200 can emit, truncating the response
      // mid-string; batching keeps every call well under the cap.
      const rankedMembers = memberRepos
        .filter((r) => staleSet.has(`${r.owner}/${r.repo}`))
        .sort((a, b) => (b.stars || 0) - (a.stars || 0));
      const chunks = chunkList(rankedMembers, LIST_CHUNK_SIZE);
      const chunkMaps = [];
      for (const chunk of chunks) {
        const chunkEntries = await callLLMJSON({
          system: SYSTEM_PROMPT,
          user: buildListPrompt(list, chunk, summaries, keptEntries),
          maxTokens: 3200,
        });
        chunkMaps.push(chunkEntries);
        if (chunks.length > 1) await sleep(DELAY_MS);
      }
      // The model may echo a kept entry back despite the prompt; only stale
      // keys are taken from its output, so a kept entry is never reworded.
      const generated = mergeEntryMaps(chunkMaps);
      const echoed = Object.keys(generated).filter((key) => memberKeys.has(key) && !staleSet.has(key));
      for (const key of echoed) delete generated[key];
      if (echoed.length > 0) {
        console.warn(`  ${list.slug}: ignored ${echoed.length} kept entr${echoed.length === 1 ? "y" : "ies"} echoed by the model`);
      }
      const entries = { ...keptEntries, ...generated };

      // A model can return valid JSON that silently omits a member's key
      // (run 33409296779 dropped one repo out of 34 and failed the whole
      // build). Give each dropped member one targeted retry — a fresh call
      // scoped to that single repo — before failing loud. One repo per call
      // makes the response unambiguous, so a key the model misspells again is
      // still recoverable (see pickSingleEntry).
      let missing = findMissingEntries(entries, memberKeys);
      if (missing.length > 0) {
        console.warn(
          `  ${list.slug}: model dropped ${missing.length} entr${missing.length === 1 ? "y" : "ies"}, retrying: ${missing.join(", ")}`,
        );
        const missingSet = new Set(missing);
        const retryMembers = rankedMembers.filter((r) =>
          missingSet.has(`${r.owner}/${r.repo}`),
        );
        for (const member of retryMembers) {
          await sleep(DELAY_MS);
          const key = `${member.owner}/${member.repo}`;
          const retryEntries = await callLLMJSON({
            system: SYSTEM_PROMPT,
            user: buildListPrompt(list, [member], summaries, keptEntries),
            maxTokens: 3200,
          });
          // Only ever writes the key we asked for — a stray key must not
          // overwrite a good description from the original pass.
          const description = pickSingleEntry(retryEntries, key);
          if (description) entries[key] = description;
        }
        missing = findMissingEntries(entries, memberKeys);
      }

      // Fail loud if any member still lacks a description (e.g. a chunk
      // still truncated, or the retry dropped the key again). Same failure
      // path as a single-call failure: throw -> caught below -> listsFailed++
      // -> the run throws at the end. The cache is not half-written.
      if (missing.length > 0) {
        throw new Error(
          `Missing list descriptions after batching: ${missing.join(", ")}`,
        );
      }

      // A model can also emit a near-miss key (wrong case, mangled owner)
      // next to the real one. Every member was just proven present above,
      // so a stray is dead weight, not data loss — drop it (logged) instead
      // of failing the whole build on it.
      const memberKeySet = new Set(memberKeys);
      const strays = Object.keys(entries).filter((k) => !memberKeySet.has(k));
      if (strays.length > 0) {
        console.warn(
          `  ${list.slug}: dropping ${strays.length} unexpected key(s) from model output: ${strays.join(", ")}`,
        );
        for (const k of strays) delete entries[k];
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
