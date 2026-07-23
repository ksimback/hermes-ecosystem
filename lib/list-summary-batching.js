/**
 * list-summary-batching.js
 *
 * Pure helpers for generating a list's per-repo descriptions in bounded
 * batches. The list-summary LLM call asks for a JSON object mapping
 * "owner/repo" -> a 2-3 sentence description for every repo in the list. With a
 * fixed maxTokens cap (3200), a large enough list (e.g. top-skills at 34 repos)
 * requires more output than the cap allows, so the JSON is truncated mid-string
 * and every parse-retry truncates identically -> hard failure. Chunking the
 * repos into small groups keeps every call comfortably under the cap; the
 * per-chunk objects are merged back into the single map shape the cache stores.
 */

// Max repos per LLM call. 12 * (~2-3 sentence description) stays well under the
// 3200-token output cap that a 34-repo single call blows past.
export const LIST_CHUNK_SIZE = 12;

/**
 * Split an array into consecutive chunks of at most `size` items.
 * Pure; does not mutate the input.
 */
export function chunkList(items, size = LIST_CHUNK_SIZE) {
  if (!Array.isArray(items)) {
    throw new TypeError("chunkList expects an array");
  }
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError("chunkList size must be a positive integer");
  }
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Merge per-chunk entry objects into a single "owner/repo" -> description map.
 * Each chunk response must be a plain JSON object (fail loud otherwise, since a
 * non-object means a chunk call returned something unusable). Later chunks win
 * on key collision, though chunk membership is disjoint in normal operation.
 */
export function mergeEntryMaps(maps) {
  if (!Array.isArray(maps)) {
    throw new TypeError("mergeEntryMaps expects an array of objects");
  }
  const merged = {};
  for (const map of maps) {
    if (!map || typeof map !== "object" || Array.isArray(map)) {
      throw new Error("Each chunk response must be a JSON object");
    }
    Object.assign(merged, map);
  }
  return merged;
}

/**
 * Return the member keys that lack a usable (non-empty string) description in
 * the merged entries. Empty result => every repo has a description.
 */
export function findMissingEntries(entries, memberKeys) {
  const keys = memberKeys instanceof Set ? memberKeys : new Set(memberKeys);
  const missing = [];
  for (const key of keys) {
    const value = entries ? entries[key] : undefined;
    if (typeof value !== "string" || value.trim().length === 0) {
      missing.push(key);
    }
  }
  return missing;
}

/**
 * Build the list-summary user prompt for a set of member repos. Kept identical
 * in shape to the single-call prompt — chunking only reduces how many repos are
 * passed per call. Pure over (list, memberRepos, summariesData).
 */
export function buildListPrompt(list, memberRepos, summariesData) {
  const projectLines = memberRepos
    .slice()
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
