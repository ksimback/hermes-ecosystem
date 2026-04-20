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
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CHUNK_SIZE = 500; // target tokens (~4 chars per token)
const CHUNK_CHARS = CHUNK_SIZE * 4;
const OVERLAP_CHARS = 200;

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) {
  console.error("Error: OPENROUTER_API_KEY environment variable required");
  process.exit(1);
}

async function main() {
  console.log("Building chunks from research files...\n");

  // Collect all markdown files
  const files = [];

  // research/ folder
  const researchDir = path.join(ROOT, "research");
  for (const f of fs.readdirSync(researchDir)) {
    if (f.endsWith(".md")) {
      files.push({ path: path.join(researchDir, f), source: `research/${f}` });
    }
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

  // Chunk all files
  const chunks = [];
  for (const file of files) {
    const content = fs.readFileSync(file.path, "utf-8");
    const fileChunks = chunkText(content, file.source);
    chunks.push(...fileChunks);
  }

  console.log(`Created ${chunks.length} chunks\n`);

  // Compute embeddings in batches
  console.log("Computing embeddings...");
  const batchSize = 20;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map(c => c.text);

    const embeddings = await getEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      batch[j].embedding = embeddings[j];
    }

    const pct = Math.min(100, Math.round(((i + batch.length) / chunks.length) * 100));
    process.stdout.write(`  ${pct}% (${i + batch.length}/${chunks.length})\r`);
  }

  console.log(`\nEmbeddings computed for all ${chunks.length} chunks`);

  // Write output
  const outputPath = path.join(ROOT, "data", "chunks.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(chunks, null, 0));

  const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
  console.log(`\nWrote ${outputPath} (${sizeMB} MB)`);
}

function chunkText(text, source) {
  const chunks = [];

  // Split by sections (## headings)
  const sections = text.split(/(?=^## )/m);

  for (const section of sections) {
    const headingMatch = section.match(/^## (.+)/);
    const heading = headingMatch ? headingMatch[1].trim() : "";

    // If section is small enough, keep as one chunk
    if (section.length <= CHUNK_CHARS) {
      if (section.trim().length > 50) {
        chunks.push({
          id: `${source}:${chunks.length}`,
          text: section.trim(),
          source,
          section: heading,
        });
      }
      continue;
    }

    // Split large sections by paragraphs
    const paragraphs = section.split(/\n\n+/);
    let current = "";

    for (const para of paragraphs) {
      if ((current + "\n\n" + para).length > CHUNK_CHARS && current.length > 50) {
        chunks.push({
          id: `${source}:${chunks.length}`,
          text: current.trim(),
          source,
          section: heading,
        });
        // Overlap: keep last portion
        current = current.slice(-OVERLAP_CHARS) + "\n\n" + para;
      } else {
        current = current ? current + "\n\n" + para : para;
      }
    }

    if (current.trim().length > 50) {
      chunks.push({
        id: `${source}:${chunks.length}`,
        text: current.trim(),
        source,
        section: heading,
      });
    }
  }

  return chunks;
}

async function getEmbeddings(texts) {
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: texts,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.data.map(d => d.embedding);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
