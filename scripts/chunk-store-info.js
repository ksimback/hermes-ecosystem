#!/usr/bin/env node
/**
 * chunk-store-info.js
 *
 * Reports the freshness of the Ask-the-Atlas RAG index (data/chunks-meta.json)
 * WITHOUT reading a build timestamp out of the file itself. The store is
 * rebuilt by .github/workflows/rebuild-chunks.yml, which auto-commits only when
 * the built files actually DIFFER — so any timestamp baked into chunks-meta.json
 * would make every scheduled run dirty and spam daily no-op commits. The build
 * date is therefore derived from git (the commit that last touched the file),
 * which is a real signal and costs the store nothing.
 *
 * Prints: last-commit date, chunk count, embedding model + dimensions, and
 * days-since-build with a WARNING line when the index is older than 7 days.
 *
 * Dependency-free: node built-ins + `git` only. Never parses or prints chunks —
 * the meta file is ~9 MB on a single line, so only its leading scalar fields
 * ({model, dimensions, count, ...}, emitted before "chunks" by writeChunkStore)
 * are read from the file head.
 *
 * Usage: node scripts/chunk-store-info.js
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const STALE_DAYS = 7;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const META_REL = "data/chunks-meta.json";
const META_ABS = path.join(ROOT, META_REL);

// Read only the head of the (huge, single-line) meta file and pull the scalar
// top-level fields. writeChunkStore serializes {model, dimensions, count,
// chunks:[...]} in that order, so these sit in the first ~100 bytes — well
// inside this window. We never materialize the chunks array.
function readScalarHeader(file, bytes = 16384) {
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const read = fs.readSync(fd, buf, 0, bytes, 0);
    const head = buf.toString("utf-8", 0, read);
    const model = head.match(/"model"\s*:\s*"([^"]*)"/);
    const dimensions = head.match(/"dimensions"\s*:\s*(\d+)/);
    const count = head.match(/"count"\s*:\s*(\d+)/);
    return {
      model: model ? model[1] : null,
      dimensions: dimensions ? Number(dimensions[1]) : null,
      count: count ? Number(count[1]) : null,
    };
  } finally {
    fs.closeSync(fd);
  }
}

// Committer date (ISO 8601) of the last commit that touched the meta file.
// Returns null if git is unavailable or the file has no commit yet (e.g. a
// freshly rebuilt but not-yet-committed working tree).
function lastCommitISO(relPath) {
  try {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%cI", "--", relPath],
      { cwd: ROOT, encoding: "utf-8" }
    ).trim();
    return out || null;
  } catch {
    return null;
  }
}

function main() {
  if (!fs.existsSync(META_ABS)) {
    console.error(`Error: ${META_REL} not found at ${META_ABS}`);
    process.exit(1);
  }

  const { model, dimensions, count } = readScalarHeader(META_ABS);
  const committedISO = lastCommitISO(META_REL);

  console.log("Ask-the-Atlas chunk store — data/chunks-meta.json");
  console.log(`  Embedding model:  ${model ?? "(unknown)"}`);
  console.log(`  Dimensions:       ${dimensions ?? "(unknown)"}`);
  console.log(`  Chunk count:      ${count ?? "(unknown)"}`);

  if (!committedISO) {
    console.log("  Last build (git): (uncommitted — no commit touches this file yet)");
    console.log("WARNING: cannot determine build date from git; treat freshness as unknown.");
    return;
  }

  const built = new Date(committedISO);
  const days = Math.floor((Date.now() - built.getTime()) / 86_400_000);
  console.log(`  Last build (git): ${committedISO}`);
  console.log(`  Days since build: ${days}`);

  if (days > STALE_DAYS) {
    console.log(
      `WARNING: index is ${days} days old (> ${STALE_DAYS}). ` +
        `Rebuild via .github/workflows/rebuild-chunks.yml (workflow_dispatch) ` +
        `or scripts/build-chunks.js so chat answers stay fresh.`
    );
  }
}

main();
