#!/usr/bin/env node
// Gate for data/plugins.json — the curated Plugins Hub (/plugins/): a short
// list of official-catalog Hermes plugins worth running, grouped by job.
// Mirrors scripts/validate-skills-json.js.
//
// Invariants that matter and aren't obvious from reading the file:
//
//  1. Catalog installs only. Every `install` must be exactly
//     `hermes plugins install <name>` — the hub only recommends entries from
//     the official plugin catalog, which are reviewed and pinned to a commit.
//     A branch-tip `owner/repo` install would quietly bypass that review.
//  2. Unlike skills, a plugin does NOT need to be in data/repos.json: most
//     official plugins share the NousResearch/hermes-official-plugins
//     monorepo. The hub links an Atlas project page only when one exists.
//  3. Each group needs >=2 plugins (a group of one is a single card, not a
//     grouping) and at most one topPick (the hub renders one hero per group).
//  4. testedAgainst stays null until the Atlas actually install-tests the
//     picks — the hub's freshness line reads it, so it must never be faked.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const VALID_TIERS = ["official", "verified", "community"];
export const MIN_GROUP_PLUGINS = 2;
export const REPO_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function expectedInstall(name) {
  return `hermes plugins install ${name}`;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function checkIsoDate(errors, field, value, today) {
  if (!isNonEmptyString(value) || !ISO_DATE_RE.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push(`${field} must be a YYYY-MM-DD date string`);
  } else if (value > today) {
    errors.push(`${field} "${value}" is in the future`);
  }
}

/**
 * @param {unknown} pluginsData   parsed data/plugins.json
 * @param {Array} [reposData]     parsed data/repos.json (unused for gating —
 *                                plugins may live outside the Atlas catalog —
 *                                accepted for signature parity with skills)
 * @returns {string[]} human-readable errors; empty means valid
 */
export function validatePlugins(pluginsData, reposData) {
  const errors = [];

  if (!isPlainObject(pluginsData)) {
    return ["data/plugins.json must contain a top-level object"];
  }

  // ── top-level fields ──
  const today = new Date().toISOString().slice(0, 10);
  checkIsoDate(errors, "updatedAt", pluginsData.updatedAt, today);
  checkIsoDate(errors, "catalogCheckedAt", pluginsData.catalogCheckedAt, today);

  if (!Number.isInteger(pluginsData.catalogEntries) || pluginsData.catalogEntries <= 0) {
    errors.push("catalogEntries must be a positive integer (the official catalog's entry count)");
  }

  const tested = pluginsData.testedAgainst;
  if (tested !== null && (!isNonEmptyString(tested) || !tested.trim().startsWith("v"))) {
    errors.push('testedAgainst must be null (not install-tested) or a string starting with "v" (e.g. "v0.22.6")');
  }

  if (pluginsData.testNote !== undefined && (!isNonEmptyString(pluginsData.testNote) || tested === null)) {
    errors.push("testNote, when present, must be a non-empty string and needs testedAgainst set");
  }

  if (!Array.isArray(pluginsData.skipped) || pluginsData.skipped.some((s) => !isNonEmptyString(s))) {
    errors.push("skipped must be an array of non-empty strings");
  }

  const useCases = Array.isArray(pluginsData.useCases) ? pluginsData.useCases : null;
  if (!useCases || useCases.length === 0) {
    errors.push("useCases must be a non-empty array");
  }

  const plugins = Array.isArray(pluginsData.plugins) ? pluginsData.plugins : null;
  if (!plugins || plugins.length === 0) {
    errors.push("plugins must be a non-empty array");
  }

  if (!useCases || !plugins) {
    return errors;
  }

  // ── use-case groups ──
  const groupSlugs = new Set();
  const groupCounts = new Map();
  const groupTopPicks = new Map();

  useCases.forEach((group, index) => {
    const label = isNonEmptyString(group?.slug) ? `useCases[${group.slug}]` : `useCases[${index}]`;

    if (!isPlainObject(group)) {
      errors.push(`${label} entry must be an object`);
      return;
    }

    if (!isNonEmptyString(group.slug)) {
      errors.push(`${label} slug must be a non-empty string`);
    } else {
      if (!SLUG_RE.test(group.slug)) {
        errors.push(`${label} slug must be lowercase kebab-case`);
      }
      if (groupSlugs.has(group.slug)) {
        errors.push(`${label} duplicate slug`);
      } else {
        groupSlugs.add(group.slug);
      }
    }

    for (const field of ["title", "intent", "description"]) {
      if (!isNonEmptyString(group[field])) {
        errors.push(`${label} ${field} must be a non-empty string`);
      }
    }
  });

  // ── plugins ──
  const seenNames = new Set();

  plugins.forEach((plugin, index) => {
    const label = isNonEmptyString(plugin?.name) ? `plugins[${plugin.name}]` : `plugins[${index}]`;

    if (!isPlainObject(plugin)) {
      errors.push(`${label} entry must be an object`);
      return;
    }

    if (!isNonEmptyString(plugin.name)) {
      errors.push(`${label} name must be a non-empty string (the official catalog name)`);
    } else if (seenNames.has(plugin.name)) {
      errors.push(`${label} duplicate plugin name "${plugin.name}"`);
    } else {
      seenNames.add(plugin.name);
    }

    for (const field of ["title", "shelf", "verdict"]) {
      if (!isNonEmptyString(plugin[field])) {
        errors.push(`${label} ${field} must be a non-empty string`);
      }
    }

    if (!isNonEmptyString(plugin.repo) || !REPO_RE.test(plugin.repo)) {
      errors.push(`${label} repo must be a GitHub "owner/name" string`);
    }

    if (!VALID_TIERS.includes(plugin.tier)) {
      errors.push(`${label} tier must be one of: ${VALID_TIERS.join(", ")}`);
    }

    if (plugin.requiresHermes !== null && !isNonEmptyString(plugin.requiresHermes)) {
      errors.push(`${label} requiresHermes must be a non-empty string or null`);
    }

    if (isNonEmptyString(plugin.name) && plugin.install !== expectedInstall(plugin.name)) {
      errors.push(
        `${label} install must be exactly "${expectedInstall(plugin.name)}" — the hub only recommends catalog installs (reviewed, pinned to a commit)`
      );
    }

    if ("caveat" in plugin && !isNonEmptyString(plugin.caveat)) {
      errors.push(`${label} caveat, when present, must be a non-empty string`);
    }

    if ("topPick" in plugin && typeof plugin.topPick !== "boolean") {
      errors.push(`${label} topPick, when present, must be a boolean`);
    }

    if (!Array.isArray(plugin.useCases) || plugin.useCases.length === 0) {
      errors.push(`${label} useCases must be a non-empty array of group slugs`);
    } else {
      for (const slug of plugin.useCases) {
        if (!isNonEmptyString(slug) || !groupSlugs.has(slug)) {
          errors.push(`${label} useCases references undefined group slug "${slug}"`);
          continue;
        }
        groupCounts.set(slug, (groupCounts.get(slug) || 0) + 1);
        if (plugin.topPick === true) {
          const existing = groupTopPicks.get(slug);
          if (existing) {
            errors.push(
              `${label} sets topPick alongside ${existing} — only one topPick allowed per group [${slug}]`
            );
          } else {
            groupTopPicks.set(slug, plugin.name);
          }
        }
      }
    }
  });

  for (const slug of groupSlugs) {
    const count = groupCounts.get(slug) || 0;
    if (count < MIN_GROUP_PLUGINS) {
      errors.push(`useCases[${slug}] has only ${count} plugin(s) referencing it — needs at least ${MIN_GROUP_PLUGINS}`);
    }
  }

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
  const pluginsPath = path.join(ROOT, "data", "plugins.json");
  if (!fs.existsSync(pluginsPath)) {
    console.error("data/plugins.json not found — nothing to validate");
    process.exit(1);
  }

  const pluginsData = readJson(pluginsPath, "data/plugins.json");
  const reposData = readJson(path.join(ROOT, "data", "repos.json"), "data/repos.json");

  const errors = validatePlugins(pluginsData, reposData);
  if (errors.length > 0) {
    console.error("data/plugins.json validation failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(
    `data/plugins.json validation passed ` +
    `(${pluginsData.useCases.length} use-case groups, ${pluginsData.plugins.length} plugins)`
  );
}

// Windows-safe entry check — see scripts/validate-repos-json.js:176
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
