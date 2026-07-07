// Knowledge-base chunk store: chunk text/metadata in data/chunks-meta.json,
// embeddings in data/embeddings.bin (little-endian float32, chunk i at
// offset i × dimensions).
//
// Why two files instead of the old all-JSON data/chunks.json: embeddings
// stored as JSON floats were ~95% of a 75 MB file, and JSON.parse turned
// them into millions of boxed numbers — near the serverless memory ceiling
// and the dominant cold-start cost. The same vectors as raw float32 are
// ~14 MB, parse for free, and are served to consumers as zero-copy
// Float32Array subarray views over one shared buffer.

import fs from "fs";
import path from "path";

export const META_FILENAME = "chunks-meta.json";
export const EMBEDDINGS_FILENAME = "embeddings.bin";

// Reads the two store files and parses them. Node-side convenience for
// scripts; api/chat.js instead does its own reads with literal
// `join(process.cwd(), "data", "...")` paths (Vercel's file tracer only
// bundles files whose read paths it can resolve statically) and calls
// parseChunkStore directly.
export function loadChunkStore(dataDir) {
  return parseChunkStore(
    fs.readFileSync(path.join(dataDir, META_FILENAME), "utf-8"),
    fs.readFileSync(path.join(dataDir, EMBEDDINGS_FILENAME))
  );
}

// Parses raw file contents into { chunks, model, dimensions, count } with
// each chunk's `embedding` attached as a Float32Array view over the shared
// buffer. Fails loud on any meta↔bin mismatch — a torn state (one file
// updated without the other) must break the build/deploy, not silently
// mis-rank retrieval.
export function parseChunkStore(metaRaw, binBuffer) {
  const meta = JSON.parse(metaRaw);
  const { model, dimensions, chunks } = meta;
  if (!Number.isInteger(dimensions) || dimensions <= 0 || !Array.isArray(chunks)) {
    throw new Error(`Malformed ${META_FILENAME}: expected {dimensions, chunks[]}`);
  }

  const buf = binBuffer;
  const expectedBytes = chunks.length * dimensions * 4;
  if (buf.byteLength !== expectedBytes) {
    throw new Error(
      `${EMBEDDINGS_FILENAME} is ${buf.byteLength} bytes; ${META_FILENAME} implies ` +
        `${expectedBytes} (${chunks.length} chunks × ${dimensions} dims × 4). ` +
        `The two files are out of sync — rebuild with scripts/build-chunks.js.`
    );
  }

  // Buffer.buffer can be a shared pool larger than the file; slice to the
  // exact range before viewing as float32.
  const floats = new Float32Array(buf.buffer, buf.byteOffset, chunks.length * dimensions);
  for (let i = 0; i < chunks.length; i++) {
    chunks[i].embedding = floats.subarray(i * dimensions, (i + 1) * dimensions);
  }

  return { chunks, model, dimensions, count: chunks.length };
}

// Writes the store. `chunks` must each carry an `embedding` of exactly
// `dimensions` floats (plain array or typed array); embeddings go to the
// .bin, everything else to the meta JSON.
export function writeChunkStore(dataDir, chunks, { model, dimensions }) {
  const floats = new Float32Array(chunks.length * dimensions);
  const metaChunks = new Array(chunks.length);

  for (let i = 0; i < chunks.length; i++) {
    const { embedding, ...rest } = chunks[i];
    if (!embedding || embedding.length !== dimensions) {
      throw new Error(
        `Chunk ${i} (${rest.id || "no id"}) has ${embedding ? embedding.length : "no"} ` +
          `embedding dims; expected ${dimensions}`
      );
    }
    floats.set(embedding, i * dimensions);
    metaChunks[i] = rest;
  }

  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, META_FILENAME),
    JSON.stringify({ model, dimensions, count: chunks.length, chunks: metaChunks }, null, 0)
  );
  fs.writeFileSync(path.join(dataDir, EMBEDDINGS_FILENAME), Buffer.from(floats.buffer));
}
