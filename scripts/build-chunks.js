#!/usr/bin/env node
/**
 * build-chunks.js
 *
 * Reads all markdown files from research/, repos/, and ECOSYSTEM.md,
 * splits them into ~500-token chunks with metadata, computes embeddings
 * via OpenRouter, and outputs data/chunks.json.
 *
 * Usage: OPENROUTER_API_KEY=... node scripts/build-chunks.js
 */

import fs from "fs";
import path from "path";
import crypto from "node:crypto";
import { fileURLToPath } from "url";
import { chunkText } from "../lib/chunk-text.js";
import { findLatestReleaseFromMarkdownFiles } from "../lib/latest-release.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
// Embedding dimensions. Default for text-embedding-3-small is 1536, but the
// model supports truncation via `dimensions`. At ~5k chunks, 1536-dim vectors
// blow chunks.json past GitHub's 100MB file limit (147MB observed). 512-dim
// is ~33% the size and OpenAI's own benchmarks show v3-small at 512 dims
// still beats v2 at full 1536 dims — quality cost is minimal.
// Query side (api/chat.js, scripts/test-rag.js) reads this dim from the
// loaded chunks at runtime, so changing it here propagates after the next
// rebuild lands.
const EMBED_DIMENSIONS = 512;

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) {
  console.error("Error: OPENROUTER_API_KEY environment variable required");
  process.exit(1);
}

async function main() {
  console.log("Building chunks from research files...\n");

  // Collect all markdown files
  const files = [];

  // research/ folder — recursive so research/docs/<...>.md (the auto-scraped
  // mirror of hermes-agent.nousresearch.com/docs) is ingested too.
  const researchDir = path.join(ROOT, "research");
  for (const abs of walkMarkdown(researchDir)) {
    const rel = path.relative(ROOT, abs).split(path.sep).join("/");
    files.push({ path: abs, source: rel });
  }

  // repos/ folder
  const reposDir = path.join(ROOT, "repos");
  for (const f of fs.readdirSync(reposDir)) {
    if (f.endsWith(".md")) {
      files.push({ path: path.join(reposDir, f), source: `repos/${f}` });
    }
  }

  // ECOSYSTEM.md
  const ecosystemPath = path.join(ROOT, "ECOSYSTEM.md");
  if (fs.existsSync(ecosystemPath)) {
    files.push({ path: ecosystemPath, source: "ECOSYSTEM.md" });
  }

  // Published handbook pages (sourced from markdown drafts, labeled as URL paths for clean RAG citations)
  const guideSources = [
    { file: "handbook-hub.md", source: "guide/" },
    { file: "handbook-vs-claude-code.md", source: "guide/vs-claude-code/" },
  ];
  for (const g of guideSources) {
    const filePath = path.join(ROOT, "drafts", g.file);
    if (fs.existsSync(filePath)) {
      files.push({ path: filePath, source: g.source });
    }
  }

  console.log(`Found ${files.length} files to process`);

  const markdownFiles = files.map((file) => ({
    source: file.source,
    content: fs.readFileSync(file.path, "utf-8"),
  }));
  writeLatestReleaseMetadata(markdownFiles);

  // Chunk all files
  const chunks = [];
  for (const file of markdownFiles) {
    const fileChunks = chunkText(file.content, file.source);
    chunks.push(...fileChunks);
  }

  console.log(`Created ${chunks.length} chunks\n`);

  // Reuse embeddings for unchanged chunks. rebuild-chunks fires on every
  // release-notes merge and repo add — usually a one-file diff — but without a
  // cache every run re-embeds all ~6.5k chunks from scratch (real, recurring
  // OpenRouter spend that grows with the corpus). Key each chunk by
  // sha256(model + dims + text) so a config change (model/dimensions) correctly
  // invalidates the cache.
  const outputPath = path.join(ROOT, "data", "chunks.json");
  const embedKey = (text) =>
    crypto
      .createHash("sha256")
      .update(`text-embedding-3-small:${EMBED_DIMENSIONS}:${text}`)
      .digest("hex");

  const embedCache = new Map();
  if (fs.existsSync(outputPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
      if (Array.isArray(prev)) {
        for (const c of prev) {
          if (c && typeof c.text === "string" && Array.isArray(c.embedding)) {
            embedCache.set(embedKey(c.text), c.embedding);
          }
        }
      }
    } catch (e) {
      console.warn(`  Could not read previous chunks.json for cache: ${e.message}`);
    }
  }

  // Assign cached embeddings; collect only the chunks that still need one.
  const toEmbed = [];
  let cacheHits = 0;
  for (const c of chunks) {
    const cached = embedCache.get(embedKey(c.text));
    if (cached) {
      c.embedding = cached;
      cacheHits++;
    } else {
      toEmbed.push(c);
    }
  }
  console.log(
    `Embedding cache: ${cacheHits} reused, ${toEmbed.length} to compute (of ${chunks.length})`
  );

  // Compute embeddings in batches (only for new/changed chunks)
  const batchSize = 20;
  for (let i = 0; i < toEmbed.length; i += batchSize) {
    const batch = toEmbed.slice(i, i + batchSize);
    const texts = batch.map(c => c.text);

    const embeddings = await getEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      batch[j].embedding = embeddings[j];
    }

    const pct = Math.min(100, Math.round(((i + batch.length) / toEmbed.length) * 100));
    process.stdout.write(`  ${pct}% (${i + batch.length}/${toEmbed.length})\r`);
  }

  console.log(`\nEmbeddings ready for all ${chunks.length} chunks (${cacheHits} cached, ${toEmbed.length} freshly computed)`);

  // Write output
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(chunks, null, 0));

  const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
  console.log(`\nWrote ${outputPath} (${sizeMB} MB)`);
}

function writeLatestReleaseMetadata(markdownFiles) {
  const latestRelease = findLatestReleaseFromMarkdownFiles(markdownFiles);
  if (!latestRelease) {
    console.warn("No release markdown found; skipping data/latest-release.json");
    return;
  }

  const outputPath = path.join(ROOT, "data", "latest-release.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(latestRelease, null, 2)}\n`);
  console.log(`Latest release metadata: ${latestRelease.version} (${latestRelease.tag || "no tag"})`);
}

function* walkMarkdown(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkMarkdown(full);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      yield full;
    }
  }
}

async function getEmbeddings(texts) {
  // Retry transient failures: HTTP 429/5xx, network errors, and 200-OK
  // responses where the body shape is unexpected (OpenRouter occasionally
  // returns errors as 200 with `{error: ...}` instead of `{data: [...]}`).
  // A single batch failure used to crash the whole rebuild — across thousands
  // of chunks that's a near-guaranteed loss.
  const maxAttempts = 5;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/text-embedding-3-small",
          input: texts,
          dimensions: EMBED_DIMENSIONS,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        const retriable = [408, 429, 500, 502, 503, 504].includes(res.status);
        if (retriable && attempt < maxAttempts) {
          lastErr = `HTTP ${res.status}: ${errBody.slice(0, 200)}`;
          await sleep(backoffMs(attempt));
          continue;
        }
        throw new Error(`Embedding API ${res.status}: ${errBody.slice(0, 500)}`);
      }

      const data = await res.json();
      if (!data || !Array.isArray(data.data)) {
        const preview = JSON.stringify(data).slice(0, 300);
        if (attempt < maxAttempts) {
          lastErr = `malformed response: ${preview}`;
          await sleep(backoffMs(attempt));
          continue;
        }
        throw new Error(`Embedding response missing .data array: ${preview}`);
      }

      return data.data.map((d) => d.embedding);
    } catch (e) {
      lastErr = e.message;
      if (attempt === maxAttempts) throw e;
      await sleep(backoffMs(attempt));
    }
  }
  throw new Error(`Embedding failed after ${maxAttempts} attempts: ${lastErr}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt) {
  // 1s, 2s, 4s, 8s with ±25% jitter
  const base = 1000 * Math.pow(2, attempt - 1);
  const jitter = base * 0.25 * (Math.random() * 2 - 1);
  return Math.round(base + jitter);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
