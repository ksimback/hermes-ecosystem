import test from "node:test";
import assert from "node:assert/strict";
import { marked } from "marked";
import { JSDOM } from "jsdom";
import { rewriteReadmeUrls } from "../lib/readme-urls.js";

function render(markdown, branch = "master") {
  return JSDOM.fragment(rewriteReadmeUrls(marked.parse(markdown), "arcmira", "mcp", branch));
}

test("README file and directory links use the actual default branch", () => {
  const page = render("[Plugin](plugins/arcmira)\n\n[Changes](./CHANGELOG.md#latest)\n\n[License](/LICENSE)");
  assert.deepEqual([...page.querySelectorAll("a")].map(a => a.href), [
    "https://github.com/arcmira/mcp/tree/master/plugins/arcmira",
    "https://github.com/arcmira/mcp/blob/master/CHANGELOG.md#latest",
    "https://github.com/arcmira/mcp/tree/master/LICENSE",
  ]);
});

test("reference links and raw HTML media resolve while external URLs and anchors stay intact", () => {
  const page = render('[Guide][g]\n\n[g]: guide.md "Guide"\n\n![Logo](./logo.png)\n\n<a href="/plugins/arcmira/">Plugin</a> <video src="demo.mp4"><source src="./demo.webm"></video>\n\n[Section](#setup) [Home](https://arcmira.com) [Mail](mailto:hello@example.com)');
  assert.equal(page.querySelector("a").href, "https://github.com/arcmira/mcp/blob/master/guide.md");
  assert.equal(page.querySelector("a").title, "Guide");
  assert.equal(page.querySelector("img").src, "https://raw.githubusercontent.com/arcmira/mcp/master/logo.png");
  assert.equal(page.querySelector("video").src, "https://raw.githubusercontent.com/arcmira/mcp/master/demo.mp4");
  assert.equal(page.querySelector("source").src, "https://raw.githubusercontent.com/arcmira/mcp/master/demo.webm");
  assert.deepEqual([...page.querySelectorAll("a")].slice(-3).map(a => a.getAttribute("href")), ["#setup", "https://arcmira.com", "mailto:hello@example.com"]);
});

test("code examples remain literal and branch names are encoded", () => {
  const page = render('`[Plugin](plugins/arcmira)`\n\n```md\n![Logo](logo.png)\n```\n\n[Guide](guide.md)', "release/v1");
  assert.equal(page.querySelector("code").textContent, "[Plugin](plugins/arcmira)");
  assert.equal(page.querySelector("pre code").textContent.trim(), "![Logo](logo.png)");
  assert.equal(page.querySelector("a").href, "https://github.com/arcmira/mcp/blob/release%2Fv1/guide.md");
});

test("GitHub metadata retains the repository default branch", async (t) => {
  const { fetchAllMetadata } = await import("../lib/github.js");
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.match(JSON.parse(options.body).query, /defaultBranchRef\s*\{\s*name\s*\}/);
    return { ok: true, json: async () => ({ data: { repo0: { stargazerCount: 1, defaultBranchRef: { name: "master" } } } }) };
  });
  const result = await fetchAllMetadata([{ owner: "arcmira", repo: "mcp" }], {});
  assert.equal(result["arcmira/mcp"].defaultBranch, "master");
});
