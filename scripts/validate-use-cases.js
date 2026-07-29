#!/usr/bin/env node
// Gate for data/use-cases.json — the curated join between the demand-side story
// corpus (data/user-stories.json) and the Atlas catalog (data/repos.json).
//
// Two invariants matter most and neither is obvious from reading the file:
//
//  1. Every recommended repo must already be in the Atlas catalog. Issue #321:
//     "No generic tool recommendations unless the repo is already accepted into
//     Atlas." A recommender that reaches outside the catalog is just an LLM.
//  2. Every stack must span at least MIN_STACK_CATEGORIES distinct catalog
//     categories. A single-category bundle is a /lists/ page wearing a hat, and
//     shipping those would cannibalize the pages we already have.
//
// Evidence is referenced by story id, never by copied quote, so a corpus
// refresh that drops a story fails here instead of leaving a page quoting text
// that no longer exists upstream.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

export const MIN_USE_CASES = 5;
export const MIN_STACK_CATEGORIES = 3;
export const MIN_STACK_ENTRIES = 3;
export const MIN_EVIDENCE = 3;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const REQUIRED_FIELDS = ["slug", "title", "intent", "aliases", "stack", "rationale", "evidence"];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeAlias(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * @param {unknown} useCases  parsed data/use-cases.json
 * @param {{repos: Array, stories: Array}} catalog
 * @returns {string[]} human-readable errors; empty means valid
 */
export function validateUseCases(useCases, { repos, stories }) {
  const errors = [];

  if (!Array.isArray(useCases)) {
    return ["use-cases.json must contain a top-level array"];
  }
  if (useCases.length < MIN_USE_CASES) {
    errors.push(`only ${useCases.length} use cases (issue #321 requires at least ${MIN_USE_CASES})`);
  }

  const repoCategory = new Map(repos.map((r) => [`${r.owner}/${r.repo}`, r.category]));
  const storyIds = new Set(stories.map((s) => s.id));

  const seenSlugs = new Set();
  const aliasOwner = new Map();

  useCases.forEach((uc, index) => {
    const label = isNonEmptyString(uc?.slug) ? `[${uc.slug}]` : `[${index}]`;

    if (!uc || typeof uc !== "object" || Array.isArray(uc)) {
      errors.push(`${label} entry must be an object`);
      return;
    }

    for (const field of REQUIRED_FIELDS) {
      if (!(field in uc)) errors.push(`${label} missing required field: ${field}`);
    }

    // ── slug ──
    if (!isNonEmptyString(uc.slug)) {
      errors.push(`${label} slug must be a non-empty string`);
    } else {
      if (!SLUG_RE.test(uc.slug)) {
        errors.push(`${label} slug must be lowercase kebab-case (drives the URL /use-cases/${uc.slug})`);
      }
      if (seenSlugs.has(uc.slug)) errors.push(`${label} duplicate slug`);
      else seenSlugs.add(uc.slug);
    }

    for (const field of ["title", "intent", "rationale"]) {
      if (field in uc && !isNonEmptyString(uc[field])) {
        errors.push(`${label} ${field} must be a non-empty string`);
      }
    }

    // ── aliases: feed the free-text matcher, so collisions make it non-deterministic ──
    if (!Array.isArray(uc.aliases) || uc.aliases.length === 0) {
      errors.push(`${label} aliases must be a non-empty array`);
    } else {
      const localSeen = new Set();
      for (const alias of uc.aliases) {
        const key = normalizeAlias(alias);
        if (!key) {
          errors.push(`${label} aliases must all be non-empty strings`);
          continue;
        }
        if (localSeen.has(key)) {
          errors.push(`${label} duplicate alias within use case: "${key}"`);
          continue;
        }
        localSeen.add(key);
        const owner = aliasOwner.get(key);
        if (owner && owner !== uc.slug) {
          errors.push(`${label} alias "${key}" also claimed by [${owner}] — matcher would be ambiguous`);
        } else {
          aliasOwner.set(key, uc.slug);
        }
      }
    }

    // ── stack: must be real catalog repos, spanning real breadth ──
    if (!Array.isArray(uc.stack) || uc.stack.length < MIN_STACK_ENTRIES) {
      errors.push(`${label} stack must be an array of at least ${MIN_STACK_ENTRIES} entries`);
    } else {
      const categories = new Set();
      const seenRepos = new Set();
      uc.stack.forEach((item, i) => {
        const itemLabel = `${label} stack[${i}]`;
        if (!item || typeof item !== "object") {
          errors.push(`${itemLabel} must be an object`);
          return;
        }
        for (const field of ["owner", "repo", "role", "why"]) {
          if (!isNonEmptyString(item[field])) {
            errors.push(`${itemLabel} missing or empty required field: ${field}`);
          }
        }
        if (!isNonEmptyString(item.owner) || !isNonEmptyString(item.repo)) return;

        const key = `${item.owner}/${item.repo}`;
        if (seenRepos.has(key)) {
          errors.push(`${itemLabel} duplicate repo within stack: ${key}`);
          return;
        }
        seenRepos.add(key);

        // Issue #321 acceptance criterion.
        if (!repoCategory.has(key)) {
          errors.push(
            `${itemLabel} ${key} is not in data/repos.json — ` +
            `use-case bundles may only recommend repos already accepted into Atlas`
          );
          return;
        }
        categories.add(repoCategory.get(key));
      });

      if (categories.size > 0 && categories.size < MIN_STACK_CATEGORIES) {
        errors.push(
          `${label} stack spans only ${categories.size} catalog categor${categories.size === 1 ? "y" : "ies"} ` +
          `(${[...categories].join(", ")}) — needs at least ${MIN_STACK_CATEGORIES}, ` +
          `otherwise this is a /lists/ page rather than a cross-category bundle`
        );
      }
    }

    // ── evidence: resolved against the corpus at build time ──
    if (!Array.isArray(uc.evidence) || uc.evidence.length < MIN_EVIDENCE) {
      errors.push(`${label} evidence must be an array of at least ${MIN_EVIDENCE} story ids`);
    } else {
      const localSeen = new Set();
      for (const id of uc.evidence) {
        if (!isNonEmptyString(id)) {
          errors.push(`${label} evidence ids must be non-empty strings`);
          continue;
        }
        if (localSeen.has(id)) errors.push(`${label} duplicate evidence id: ${id}`);
        else localSeen.add(id);
        if (!storyIds.has(id)) {
          errors.push(
            `${label} evidence id "${id}" not found in data/user-stories.json — ` +
            `re-run scripts/sync-user-stories.js, or the story was removed upstream`
          );
        }
      }
    }

    // ── optional arrays ──
    for (const field of ["caveats", "gaps", "storyCategories"]) {
      if (field in uc) {
        if (!Array.isArray(uc[field])) {
          errors.push(`${label} ${field} must be an array when present`);
        } else if (uc[field].some((v) => !isNonEmptyString(v))) {
          errors.push(`${label} ${field} entries must be non-empty strings`);
        }
      }
    }
  });

  return errors;
}

function readJson(filePath, description) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`${description} could not be read: ${error.message}`);
    process.exit(1);
  }
}

function main() {
  const useCases = readJson(path.join(ROOT, "data", "use-cases.json"), "data/use-cases.json");
  const repos = readJson(path.join(ROOT, "data", "repos.json"), "data/repos.json");
  const corpus = readJson(path.join(ROOT, "data", "user-stories.json"), "data/user-stories.json");
  const stories = Array.isArray(corpus?.stories) ? corpus.stories : [];

  if (stories.length === 0) {
    console.error("data/user-stories.json has no stories — run scripts/sync-user-stories.js first");
    process.exit(1);
  }

  const errors = validateUseCases(useCases, { repos, stories });
  if (errors.length > 0) {
    console.error("data/use-cases.json validation failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  const repoRefs = useCases.reduce((n, uc) => n + uc.stack.length, 0);
  const evidenceRefs = useCases.reduce((n, uc) => n + uc.evidence.length, 0);
  console.log(
    `data/use-cases.json validation passed ` +
    `(${useCases.length} use cases, ${repoRefs} repo picks, ${evidenceRefs} evidence citations)`
  );
}

// Windows-safe entry check — see scripts/validate-repos-json.js:176
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
