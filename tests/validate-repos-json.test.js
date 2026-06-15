import test from "node:test";
import assert from "node:assert/strict";

import {
  validateRepos,
  CANONICAL_CATEGORIES,
} from "../scripts/validate-repos-json.js";

const validRepo = {
  owner: "example",
  repo: "hermes-example",
  name: "hermes-example",
  description: "Example Hermes integration",
  stars: 1,
  url: "https://github.com/example/hermes-example",
  official: false,
  category: "Developer Tools",
};

test("validates a well-formed repos.json entry", () => {
  assert.deepEqual(validateRepos([validRepo]), []);
});

test("reports missing required fields", () => {
  const { owner, ...missingOwner } = validRepo;

  assert.deepEqual(validateRepos([missingOwner]), [
    "[0] missing required field: owner",
  ]);
});

test("rejects duplicate owner/repo pairs case-insensitively", () => {
  const duplicate = { ...validRepo, owner: "Example", repo: "Hermes-Example" };

  assert.deepEqual(validateRepos([validRepo, duplicate]), [
    "[1] duplicate owner/repo: example/hermes-example",
  ]);
});

test("rejects invalid category, URL, official, and stars values", () => {
  const badRepo = {
    ...validRepo,
    category: "Random Stuff",
    url: "https://example.com/example/hermes-example",
    official: "false",
    stars: -1,
  };

  assert.deepEqual(validateRepos([badRepo]), [
    `[0] category must be one of: ${CANONICAL_CATEGORIES.join(", ")}`,
    "[0] url must match https://github.com/example/hermes-example",
    "[0] official must be boolean",
    "[0] stars must be a non-negative integer",
  ]);
});
