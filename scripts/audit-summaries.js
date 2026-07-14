#!/usr/bin/env node
/**
 * audit-summaries.js
 *
 * Weekly audit that verifies each generated summary against the current README.
 * Uses an LLM to detect hallucinated claims — facts in the summary that aren't
 * supported by the README content.
 *
 * Entries with unsupported claims get flagged with "audit": "flagged".
 * Flagged entries will be regenerated on the next generate-summaries.js run.
 *
 * Usage: GITHUB_TOKEN=... OPENROUTER_API_KEY=... node scripts/audit-summaries.js
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { githubHeaders, fetchReadme } from "../lib/github.js";
import { callOpenRouter } from "../lib/openrouter.js";
import { writeJsonCheckpoint } from "../lib/json-checkpoint.js";
import { mapWithConcurrency } from "../lib/bounded-concurrency.js";
import { auditVerdictIsPass } from "../lib/summary-pruning.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

if (!GITHUB_TOKEN || !OPENROUTER_KEY) {
  console.error("Error: GITHUB_TOKEN and OPENROUTER_API_KEY required");
  process.exit(1);
}

const GITHUB_HEADERS = githubHeaders(GITHUB_TOKEN);
const DELAY_MS = 1500;
const AUDIT_CONCURRENCY = Math.min(
  Math.max(parseInt(process.env.AUDIT_CONCURRENCY || "3", 10) || 3, 1),
  6,
);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const summariesPath = path.join(ROOT, "data", "summaries.json");
const summaries = JSON.parse(fs.readFileSync(summariesPath, "utf-8"));

async function main() {
  const keys = Object.keys(summaries);
  console.log(`Auditing ${keys.length} summaries...\n`);

  let passed = 0;
  let flagged = 0;
  let skipped = 0;

  await mapWithConcurrency(keys, AUDIT_CONCURRENCY, async (key) => {
    const entry = summaries[key];
    if (!entry.summary) {
      skipped++;
      return;
    }

    const [owner, repo] = key.split("/");
    const readme = await fetchReadme(owner, repo, GITHUB_HEADERS);
    if (!readme) {
      console.log(`  ${key}: no README, skipping`);
      skipped++;
      return;
    }

    const currentReadmeHash = crypto.createHash("sha256").update(readme).digest("hex");
    if (
      entry.audit === "pass" &&
      entry.auditedAt &&
      entry.readmeHash === currentReadmeHash
    ) {
      skipped++;
      return;
    }

    console.log(`  ${key}: auditing...`);

    try {
      const response = await callOpenRouter({
        system:
          "You are a fact-checker. Compare a summary against its source README. Identify any specific claims in the summary that are NOT supported by the README content. Be strict — if a number, feature name, or capability is mentioned in the summary but not in the README, flag it.",
        user: `README (source of truth):
---
${readme.slice(0, 6000)}
---

Summary to verify:
"${entry.summary}"

Highlights to verify:
${entry.highlights?.map((h) => `- "${h}"`).join("\n") || "None"}

List each unsupported claim, or respond with exactly "NONE" if all claims are supported.`,
        apiKey: OPENROUTER_KEY,
        maxTokens: 300,
      });

      const trimmed = response.trim();
      if (auditVerdictIsPass(trimmed)) {
        entry.audit = "pass";
        entry.auditedAt = new Date().toISOString();
        passed++;
      } else {
        entry.audit = "flagged";
        entry.auditedAt = new Date().toISOString();
        entry.auditNotes = trimmed.slice(0, 500);
        entry.readmeHash = "";
        flagged++;
        console.warn(`    FLAGGED: ${trimmed.slice(0, 150)}`);
      }
    } catch (e) {
      console.error(`    Audit error for ${key}: ${e.message}`);
      skipped++;
    }

    if (entry.auditedAt) writeJsonCheckpoint(summariesPath, summaries);

    await sleep(DELAY_MS);
  });

  writeJsonCheckpoint(summariesPath, summaries);

  console.log(
    `\nAudit complete: ${passed} passed, ${flagged} flagged, ${skipped} skipped`
  );
  if (flagged > 0) {
    console.log(
      "Flagged entries will be regenerated on the next generate-summaries.js run."
    );
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
