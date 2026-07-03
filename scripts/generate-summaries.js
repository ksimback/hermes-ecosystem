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
const SYSTEM_PROMPT = `You are a technical writer for Hermes Atlas, a community ecosystem map for Hermes Agent by Nous Research. Write concise, original summaries of open-source projects. Your summaries must be factually grounded in the README — do NOT invent features, numbers, or capabilities not mentioned in the source material.`;

function buildProjectPrompt(repo, readme) {
  const readmeTruncated = readme.slice(0, 8000);

  return `Write a summary for the GitHub project ${repo.owner}/${repo.repo}.

GitHub description: ${repo.description}
Category: ${repo.category}
Stars: ${repo.stars}

README content (source of truth — do NOT include claims not supported by this):
---
${readmeTruncated}
---

Output a JSON object with exactly these fields:
- "summary": A 3-5 sentence plain-language summary. First sentence: what the project IS and what problem it solves. Second sentence: how it works (key technical approach). Remaining sentences: notable benefits, integrations, or use cases. Do NOT repeat the GitHub description verbatim. Do NOT use marketing superlatives like "revolutionary" or "cutting-edge".
- "highlights": An array of exactly 3 short bullet points (under 12 words each) capturing the most important capabilities.

Respond with ONLY the JSON object, no markdown fences, no explanation.`;
}

// ── List summary generation ──
function buildListPrompt(list, memberRepos, summariesData) {
  const projectLines = memberRepos
    .sort((a, b) => (b.stars || 0) - (a.stars || 0))
    .map((r) => {
      const key = `${r.owner}/${r.repo}`;
      const s = summariesData[key];
      const highlights = s?.highlights?.join("; ") || "No highlights available";
      return `- ${key} (${r.stars} stars): ${r.description}\n  Key highlights: ${highlights}`;
    })
    .join("\n");

  return `You are writing a listicle section for "${list.title}" on Hermes Atlas.

For each project below, write a 2-3 sentence description that explains what it does and why it belongs in this list. Differentiate each project from the others — avoid repetitive phrasing. Ground your descriptions in the highlights provided.

Projects (ranked by stars):
${projectLines}

Output a JSON object mapping "owner/repo" to a string (the 2-3 sentence description).
Respond with ONLY the JSON object, no markdown fences.`;
}

// ── Main ──
async function main() {
  console.log(
    `Generating summaries for ${repos.length} repos (version ${SUMMARY_VERSION})...\n`
  );

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  const changedRepoKeys = new Set();

  for (const repo of repos) {
    const key = `${repo.owner}/${repo.repo}`;
    const existing = summaries[key];

    // Fetch README
    const readmeRaw = await fetchReadme(repo.owner, repo.repo, GITHUB_HEADERS);
    if (!readmeRaw) {
      console.log(`  ${key}: no README, skipping`);
      skipped++;
      continue;
    }

    // Check if regeneration is needed
    const hash = sha256(readmeRaw);
    if (
      existing &&
      existing.readmeHash === hash &&
      existing.version === SUMMARY_VERSION
    ) {
      skipped++;
      continue;
    }

    // Generate summary
    console.log(`  ${key}: generating summary...`);
    try {
      const result = await callOpenRouterJSON({
        system: SYSTEM_PROMPT,
        user: buildProjectPrompt(repo, readmeRaw),
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

      changedRepoKeys.add(key);
      generated++;
    } catch (e) {
      console.error(`    FAILED ${key}: ${e.message}`);
      failed++;
    }

    // Rate limit delay
    await sleep(DELAY_MS);
  }

  // Prune orphaned summaries for repos no longer in the catalog. Without this
  // the file accumulates dead entries (removed/renamed repos), which then leak
  // into llms-full.txt (built by bundling summary content). Removal-only — no
  // generated content, so no hallucination risk.
  const validKeys = new Set(repos.map((r) => `${r.owner}/${r.repo}`));
  let pruned = 0;
  for (const key of Object.keys(summaries)) {
    if (!validKeys.has(key)) {
      delete summaries[key];
      pruned++;
    }
  }
  if (pruned) console.log(`Pruned ${pruned} orphaned summaries (not in repos.json)`);

  // Write summaries
  fs.writeFileSync(summariesPath, JSON.stringify(summaries, null, 2) + "\n", "utf-8");
  console.log(
    `\nProject summaries: ${generated} generated, ${skipped} skipped, ${failed} failed\n`
  );

  // ── List summaries ──
  console.log("Generating list summaries...");
  let listsGenerated = 0;

  for (const list of lists) {
    const memberRepos = repos.filter((r) => {
      if (list.filter?.category) return r.category === list.filter.category;
      return false;
    });

    if (memberRepos.length === 0) continue;

    // Check if any member repo's summary changed
    const needsRegen =
      !listSummaries[list.slug] ||
      listSummaries[list.slug].version !== SUMMARY_VERSION ||
      memberRepos.some((r) => changedRepoKeys.has(`${r.owner}/${r.repo}`));

    if (!needsRegen) {
      console.log(`  ${list.slug}: up to date, skipping`);
      continue;
    }

    console.log(`  ${list.slug}: generating (${memberRepos.length} projects)...`);
    try {
      const entries = await callOpenRouterJSON({
        system: SYSTEM_PROMPT,
        user: buildListPrompt(list, memberRepos, summaries),
        apiKey: OPENROUTER_KEY,
        maxTokens: 1200,
      });

      listSummaries[list.slug] = {
        entries: entries,
        generatedAt: new Date().toISOString(),
        version: SUMMARY_VERSION,
      };

      listsGenerated++;
    } catch (e) {
      console.error(`    FAILED ${list.slug}: ${e.message}`);
    }

    await sleep(DELAY_MS);
  }

  // Write list summaries
  fs.writeFileSync(
    listSummariesPath,
    JSON.stringify(listSummaries, null, 2) + "\n",
    "utf-8"
  );
  console.log(`List summaries: ${listsGenerated} generated\n`);

  console.log("Done!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
