import test from "node:test";
import assert from "node:assert/strict";

import { validateSkills, MIN_GROUP_SKILLS, SKILLS_CATEGORY } from "../scripts/validate-skills-json.js";

// ── fixtures ──────────────────────────────────────────────────────────────

const repos = [
  { owner: "acme", repo: "coder-skill", category: SKILLS_CATEGORY },
  { owner: "acme", repo: "coder-plugin", category: SKILLS_CATEGORY },
  { owner: "acme", repo: "writer-registry", category: SKILLS_CATEGORY },
  { owner: "acme", repo: "writer-collection", category: SKILLS_CATEGORY },
  { owner: "acme", repo: "unrelated-tool", category: "Memory & Context" },
];

const existingUseCases = [{ slug: "already-taken" }];

function makeSkillsData() {
  return {
    updatedAt: "2026-08-20",
    testedAgainst: "v0.20.4",
    useCases: [
      {
        slug: "coding",
        title: "Coding",
        intent: "I want skills that help me write code",
        description: "Skills useful for software development tasks.",
      },
      {
        slug: "writing",
        title: "Writing",
        intent: "I want skills that help me write prose",
        description: "Skills useful for writing tasks.",
      },
    ],
    skills: [
      {
        owner: "acme",
        repo: "coder-skill",
        type: "skill",
        install: "hermes skill install acme/coder-skill",
        compatibility: "v0.20+",
        verdict: "Solid.",
        useCases: ["coding"],
        topPick: true,
      },
      {
        owner: "acme",
        repo: "coder-plugin",
        type: "plugin",
        install: "hermes plugin install acme/coder-plugin",
        compatibility: "v0.20+",
        verdict: "Also solid.",
        useCases: ["coding"],
      },
      {
        owner: "acme",
        repo: "writer-registry",
        type: "registry",
        install: "",
        compatibility: "v0.20+",
        verdict: "Good registry.",
        useCases: ["writing"],
        topPick: true,
      },
      {
        owner: "acme",
        repo: "writer-collection",
        type: "collection",
        compatibility: "v0.20+",
        verdict: "Good collection.",
        useCases: ["writing"],
      },
    ],
  };
}

// ── validate-skills-json ─────────────────────────────────────────────────

test("accepts a well-formed skills.json fixture", () => {
  assert.deepEqual(validateSkills(makeSkillsData(), repos, existingUseCases), []);
});

test("rejects a skill whose repo is not in data/repos.json", () => {
  const data = makeSkillsData();
  data.skills.push({
    owner: "ghost",
    repo: "not-in-atlas",
    type: "skill",
    install: "x",
    verdict: "v",
    useCases: ["coding"],
  });
  const errors = validateSkills(data, repos, existingUseCases);
  assert.ok(errors.some((e) => /ghost\/not-in-atlas is not in data\/repos\.json/.test(e)));
});

test("rejects a repo outside the Skills category without crossCategory", () => {
  const data = makeSkillsData();
  data.skills.push({
    owner: "acme",
    repo: "unrelated-tool",
    type: "skill",
    install: "x",
    verdict: "v",
    useCases: ["coding"],
  });
  const errors = validateSkills(data, repos, existingUseCases);
  assert.ok(errors.some((e) => /not "Skills & Skill Registries"/.test(e)));

  // crossCategory: true lets it through.
  data.skills[data.skills.length - 1].crossCategory = true;
  const errors2 = validateSkills(data, repos, existingUseCases);
  assert.ok(!errors2.some((e) => /not "Skills & Skill Registries"/.test(e)));
});

test("rejects a skill referencing an undefined use-case group slug", () => {
  const data = makeSkillsData();
  data.skills[0].useCases = ["not-a-real-group"];
  const errors = validateSkills(data, repos, existingUseCases);
  assert.ok(errors.some((e) => /references undefined group slug "not-a-real-group"/.test(e)));
});

test("rejects two topPicks within the same group", () => {
  const data = makeSkillsData();
  data.skills[1].topPick = true; // coder-plugin also in "coding" group
  const errors = validateSkills(data, repos, existingUseCases);
  assert.ok(errors.some((e) => /only one topPick allowed per group \[coding\]/.test(e)));
});

test("rejects a group with fewer than the minimum number of skills", () => {
  const data = makeSkillsData();
  data.useCases.push({
    slug: "lonely-group",
    title: "Lonely",
    intent: "I want a group with one skill",
    description: "Only one skill references this.",
  });
  data.skills[0].useCases.push("lonely-group");
  const errors = validateSkills(data, repos, existingUseCases);
  assert.ok(
    errors.some((e) => new RegExp(`\\[lonely-group\\] has only 1 skill.*at least ${MIN_GROUP_SKILLS}`).test(e))
  );
});

test("rejects a use-case group slug that collides with data/use-cases.json", () => {
  const data = makeSkillsData();
  data.useCases[0].slug = "already-taken";
  data.skills[0].useCases = ["already-taken"];
  data.skills[1].useCases = ["already-taken"];
  const errors = validateSkills(data, repos, existingUseCases);
  assert.ok(errors.some((e) => /collides with a slug already defined in data\/use-cases\.json/.test(e)));
});

test("rejects a future updatedAt", () => {
  const data = makeSkillsData();
  data.updatedAt = "2099-01-01";
  const errors = validateSkills(data, repos, existingUseCases);
  assert.ok(errors.some((e) => /is in the future/.test(e)));
});

test("rejects a skill of type 'skill' missing install", () => {
  const data = makeSkillsData();
  delete data.skills[0].install;
  const errors = validateSkills(data, repos, existingUseCases);
  assert.ok(errors.some((e) => /install is required and must be non-empty when type is "skill"/.test(e)));
});
