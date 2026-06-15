#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CANONICAL_CATEGORIES = [
  "Core & Official",
  "Deployment & Infra",
  "Developer Tools",
  "Domain Applications",
  "Forks & Derivatives",
  "Guides & Docs",
  "Integrations & Bridges",
  "Memory & Context",
  "Multi-Agent & Orchestration",
  "Plugins & Extensions",
  "Skills & Skill Registries",
  "Workspaces & GUIs",
];

const REQUIRED_FIELDS = [
  "owner",
  "repo",
  "name",
  "description",
  "stars",
  "url",
  "official",
  "category",
];

function labelFor(index) {
  return `[${index}]`;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateRepos(repos) {
  const errors = [];

  if (!Array.isArray(repos)) {
    return ["repos.json must contain a top-level array"];
  }

  const seen = new Set();

  repos.forEach((entry, index) => {
    const label = labelFor(index);

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${label} entry must be an object`);
      return;
    }

    for (const field of REQUIRED_FIELDS) {
      if (!(field in entry)) {
        errors.push(`${label} missing required field: ${field}`);
      }
    }

    if ("owner" in entry && !isNonEmptyString(entry.owner)) {
      errors.push(`${label} owner must be a non-empty string`);
    }

    if ("repo" in entry && !isNonEmptyString(entry.repo)) {
      errors.push(`${label} repo must be a non-empty string`);
    }

    if ("name" in entry && !isNonEmptyString(entry.name)) {
      errors.push(`${label} name must be a non-empty string`);
    }

    if ("description" in entry && !isNonEmptyString(entry.description)) {
      errors.push(`${label} description must be a non-empty string`);
    }

    let duplicateOwnerRepo = false;
    if (isNonEmptyString(entry.owner) && isNonEmptyString(entry.repo)) {
      const key = `${entry.owner.toLowerCase()}/${entry.repo.toLowerCase()}`;
      if (seen.has(key)) {
        errors.push(`${label} duplicate owner/repo: ${key}`);
        duplicateOwnerRepo = true;
      } else {
        seen.add(key);
      }
    }

    if (
      "category" in entry &&
      !CANONICAL_CATEGORIES.includes(entry.category)
    ) {
      errors.push(
        `${label} category must be one of: ${CANONICAL_CATEGORIES.join(", ")}`,
      );
    }

    if ("url" in entry && !isNonEmptyString(entry.url)) {
      errors.push(`${label} url must be a non-empty string`);
    }

    if (
      !duplicateOwnerRepo &&
      isNonEmptyString(entry.owner) &&
      isNonEmptyString(entry.repo) &&
      isNonEmptyString(entry.url)
    ) {
      const expectedUrl = `https://github.com/${entry.owner}/${entry.repo}`;
      if (entry.url.toLowerCase() !== expectedUrl.toLowerCase()) {
        errors.push(`${label} url must match ${expectedUrl}`);
      }
    }

    if ("official" in entry && typeof entry.official !== "boolean") {
      errors.push(`${label} official must be boolean`);
    }

    if (
      "stars" in entry &&
      (!Number.isInteger(entry.stars) || entry.stars < 0)
    ) {
      errors.push(`${label} stars must be a non-negative integer`);
    }
  });

  return errors;
}

function readReposJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return { parseError: error };
  }
}

function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, "..");
  const reposPath = path.join(repoRoot, "data", "repos.json");
  const parsed = readReposJson(reposPath);

  if (parsed.parseError) {
    console.error(`data/repos.json is not valid JSON: ${parsed.parseError.message}`);
    process.exit(1);
  }

  const errors = validateRepos(parsed);
  if (errors.length > 0) {
    console.error("data/repos.json validation failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`data/repos.json validation passed (${parsed.length} repos)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
