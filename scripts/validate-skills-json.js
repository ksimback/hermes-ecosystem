#!/usr/bin/env node
// Gate for data/skills.json — the curated Skills Hub join between hand-picked
// use-case groups ("coding", "writing", ...) and the Atlas catalog
// (data/repos.json). Mirrors scripts/validate-use-cases.js.
//
// Invariants that matter and aren't obvious from reading the file:
//
//  1. Every skill must reference a repo already accepted into the Atlas
//     catalog — same "no generic recommendations" rule as use-cases.json.
//  2. A skill's repo must actually be categorized under "Skills & Skill
//     Registries" unless the curator explicitly flags it crossCategory —
//     otherwise the hub silently pulls in unrelated tooling.
//  3. Use-case group slugs must not collide with data/use-cases.json slugs —
//     the two "I want to build X" surfaces share a URL namespace.
//  4. Each group needs >=2 skills (a group of one is a single card, not a
//     grouping) and at most one topPick (the hub renders one hero per group).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SKILLS_CATEGORY = "Skills & Skill Registries";
export const VALID_TYPES = ["skill", "plugin", "registry", "collection"];
export const MIN_GROUP_SKILLS = 2;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} skillsData     parsed data/skills.json
 * @param {Array} reposData        parsed data/repos.json
 * @param {Array} useCasesData     parsed data/use-cases.json
 * @returns {string[]} human-readable errors; empty means valid
 */
export function validateSkills(skillsData, reposData, useCasesData) {
  const errors = [];

  if (!isPlainObject(skillsData)) {
    return ["data/skills.json must contain a top-level object"];
  }

  // ── top-level fields ──
  if (!isNonEmptyString(skillsData.updatedAt) || !ISO_DATE_RE.test(skillsData.updatedAt)) {
    errors.push("updatedAt must be a YYYY-MM-DD date string");
  } else {
    const today = new Date().toISOString().slice(0, 10);
    if (skillsData.updatedAt > today) {
      errors.push(`updatedAt "${skillsData.updatedAt}" is in the future`);
    }
  }

  if (!isNonEmptyString(skillsData.testedAgainst) || !skillsData.testedAgainst.trim().startsWith("v")) {
    errors.push('testedAgainst must be a non-empty string starting with "v" (e.g. "v0.20.4")');
  }

  const useCases = Array.isArray(skillsData.useCases) ? skillsData.useCases : null;
  if (!useCases || useCases.length === 0) {
    errors.push("useCases must be a non-empty array");
  }

  const skills = Array.isArray(skillsData.skills) ? skillsData.skills : null;
  if (!skills || skills.length === 0) {
    errors.push("skills must be a non-empty array");
  }

  if (!useCases || !skills) {
    return errors;
  }

  // ── use-case groups ──
  const existingUseCaseSlugs = new Set(
    (Array.isArray(useCasesData) ? useCasesData : [])
      .map((uc) => uc?.slug)
      .filter(isNonEmptyString)
  );

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
      if (existingUseCaseSlugs.has(group.slug)) {
        errors.push(
          `${label} slug "${group.slug}" collides with a slug already defined in data/use-cases.json`
        );
      }
    }

    for (const field of ["title", "intent", "description"]) {
      if (!isNonEmptyString(group[field])) {
        errors.push(`${label} ${field} must be a non-empty string`);
      }
    }
  });

  // ── skills ──
  const repoCategory = new Map(
    (Array.isArray(reposData) ? reposData : []).map((r) => [`${r.owner}/${r.repo}`, r.category])
  );

  const seenRepoEntries = new Set();

  skills.forEach((skill, index) => {
    const key = isNonEmptyString(skill?.owner) && isNonEmptyString(skill?.repo)
      ? `${skill.owner}/${skill.repo}`
      : null;
    const label = key ? `skills[${key}]` : `skills[${index}]`;

    if (!isPlainObject(skill)) {
      errors.push(`${label} entry must be an object`);
      return;
    }

    if (!isNonEmptyString(skill.owner) || !isNonEmptyString(skill.repo)) {
      errors.push(`${label} owner and repo must both be non-empty strings`);
      return;
    }

    if (seenRepoEntries.has(key)) {
      errors.push(`${label} duplicate skill entry for ${key}`);
    } else {
      seenRepoEntries.add(key);
    }

    if (!repoCategory.has(key)) {
      errors.push(
        `${label} ${key} is not in data/repos.json — skills hub entries may only reference repos already accepted into Atlas`
      );
    } else {
      const category = repoCategory.get(key);
      if (category !== SKILLS_CATEGORY && skill.crossCategory !== true) {
        errors.push(
          `${label} ${key} is categorized "${category}", not "${SKILLS_CATEGORY}" — set crossCategory: true if this is intentional`
        );
      }
    }

    if (!VALID_TYPES.includes(skill.type)) {
      errors.push(`${label} type must be one of: ${VALID_TYPES.join(", ")}`);
    }

    if ((skill.type === "skill" || skill.type === "plugin") && !isNonEmptyString(skill.install)) {
      errors.push(`${label} install is required and must be non-empty when type is "${skill.type}"`);
    }

    if (!isNonEmptyString(skill.verdict)) {
      errors.push(`${label} verdict must be a non-empty string`);
    }

    if (!Array.isArray(skill.useCases) || skill.useCases.length === 0) {
      errors.push(`${label} useCases must be a non-empty array of group slugs`);
    } else {
      for (const slug of skill.useCases) {
        if (!isNonEmptyString(slug) || !groupSlugs.has(slug)) {
          errors.push(`${label} useCases references undefined group slug "${slug}"`);
          continue;
        }
        groupCounts.set(slug, (groupCounts.get(slug) || 0) + 1);
        if (skill.topPick === true) {
          const existing = groupTopPicks.get(slug);
          if (existing) {
            errors.push(
              `${label} sets topPick alongside ${existing} — only one topPick allowed per group [${slug}]`
            );
          } else {
            groupTopPicks.set(slug, key);
          }
        }
      }
    }
  });

  for (const slug of groupSlugs) {
    const count = groupCounts.get(slug) || 0;
    if (count < MIN_GROUP_SKILLS) {
      errors.push(`useCases[${slug}] has only ${count} skill(s) referencing it — needs at least ${MIN_GROUP_SKILLS}`);
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
  const skillsPath = path.join(ROOT, "data", "skills.json");
  if (!fs.existsSync(skillsPath)) {
    console.error("data/skills.json not found — nothing to validate");
    process.exit(1);
  }

  const skillsData = readJson(skillsPath, "data/skills.json");
  const reposData = readJson(path.join(ROOT, "data", "repos.json"), "data/repos.json");
  const useCasesData = readJson(path.join(ROOT, "data", "use-cases.json"), "data/use-cases.json");

  const errors = validateSkills(skillsData, reposData, useCasesData);
  if (errors.length > 0) {
    console.error("data/skills.json validation failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(
    `data/skills.json validation passed ` +
    `(${skillsData.useCases.length} use-case groups, ${skillsData.skills.length} skills)`
  );
}

// Windows-safe entry check — see scripts/validate-repos-json.js:176
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
