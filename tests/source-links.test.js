import test from "node:test";
import assert from "node:assert/strict";
import { resolveSourceUrl, collectSourceLinks } from "../lib/source-links.js";

// Every mapping here was verified against the live sites (HTTP 200) before the
// rule was added. These tests lock the shape so a refactor cannot silently
// start emitting 404s into user-facing citations.
test("maps the upstream docs mirror to the canonical Nous docs URL", () => {
  const r = resolveSourceUrl("research/docs/getting-started/quickstart.md");
  assert.equal(r.url, "https://hermes-agent.nousresearch.com/docs/getting-started/quickstart");
  assert.equal(r.kind, "Hermes docs");
  assert.equal(r.label, "Quickstart");
});

test("preserves nested docs paths", () => {
  const r = resolveSourceUrl("research/docs/user-guide/features/credential-pools.md");
  assert.equal(
    r.url,
    "https://hermes-agent.nousresearch.com/docs/user-guide/features/credential-pools",
  );
  assert.equal(r.label, "Credential Pools");
});

test("maps Atlas guide and use-case sources to their published pages", () => {
  assert.equal(resolveSourceUrl("guide/").url, "https://hermesatlas.com/guide/");
  assert.equal(
    resolveSourceUrl("guide/vs-claude-code/").url,
    "https://hermesatlas.com/guide/vs-claude-code/",
  );
  const uc = resolveSourceUrl("use-cases/hermes-in-your-pocket/");
  assert.equal(uc.url, "https://hermesatlas.com/use-cases/hermes-in-your-pocket/");
  assert.equal(uc.kind, "Atlas use case");
  assert.equal(uc.label, "Hermes In Your Pocket");
});

// The decision: sources with no reader-facing page are dropped, not linked
// somewhere invented and not rendered as dead text.
test("returns null for Atlas-internal research with no public page", () => {
  assert.equal(resolveSourceUrl("research/00-landing-page.md"), null);
  assert.equal(resolveSourceUrl("research/31-orange-book-complete-guide.md"), null);
  assert.equal(resolveSourceUrl("repos/all-star-counts.md"), null);
  assert.equal(resolveSourceUrl("ECOSYSTEM.md"), null);
});

test("rejects malformed, empty, and traversal-shaped sources", () => {
  assert.equal(resolveSourceUrl(""), null);
  assert.equal(resolveSourceUrl(null), null);
  assert.equal(resolveSourceUrl(undefined), null);
  assert.equal(resolveSourceUrl(42), null);
  assert.equal(resolveSourceUrl("research/docs/../../etc/passwd"), null);
  assert.equal(resolveSourceUrl("research/docs/"), null);
});

// Caught in real production output, where the live API cited "Cli Commands"
// and "Faq" for an install question.
test("labels keep acronyms upper-case instead of sentence-casing them", () => {
  assert.equal(resolveSourceUrl("research/docs/reference/cli-commands.md").label, "CLI Commands");
  assert.equal(resolveSourceUrl("research/docs/reference/faq.md").label, "FAQ");
  assert.equal(resolveSourceUrl("research/docs/developer-guide/acp-internals.md").label, "ACP Internals");
  assert.equal(resolveSourceUrl("research/docs/integrations/mcp-gateway.md").label, "MCP Gateway");
  // Ordinary words are still capitalized normally.
  assert.equal(resolveSourceUrl("research/docs/getting-started/quickstart.md").label, "Quickstart");
  assert.equal(
    resolveSourceUrl("research/docs/user-guide/features/credential-pools.md").label,
    "Credential Pools",
  );
});

test("collectSourceLinks de-duplicates by URL and preserves rank order", () => {
  const links = collectSourceLinks([
    { source: "research/docs/getting-started/quickstart.md" },
    { source: "research/00-landing-page.md" },
    { source: "research/docs/getting-started/quickstart.md" },
    { source: "guide/" },
  ]);
  assert.equal(links.length, 2);
  assert.match(links[0].url, /quickstart$/);
  assert.equal(links[1].url, "https://hermesatlas.com/guide/");
});

test("collectSourceLinks caps the list and tolerates junk input", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    source: `research/docs/reference/cmd-${i}.md`,
  }));
  assert.equal(collectSourceLinks(many).length, 4);
  assert.equal(collectSourceLinks(many, 2).length, 2);
  assert.deepEqual(collectSourceLinks(null), []);
  assert.deepEqual(collectSourceLinks([null, {}, { source: "" }]), []);
});

test("every emitted URL is https, so the client's scheme guard never trips", () => {
  const links = collectSourceLinks([
    { source: "research/docs/reference/cli-commands.md" },
    { source: "use-cases/cut-your-token-bill/" },
    { source: "guide/vs-claude-code/" },
  ]);
  assert.equal(links.length, 3);
  for (const l of links) assert.match(l.url, /^https:\/\//);
});
