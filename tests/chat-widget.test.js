import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { JSDOM } from "jsdom";

// Behavioral tests for the chat widget's dialog semantics, empty state, and
// source citations. Same harness as homepage-controls.test.js: jsdom does not
// fetch external <script src>, so the app bundle is eval'd manually after parse,
// which matches the `defer` semantics the real page relies on.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const appJs = fs.readFileSync(
  path.join(__dirname, "..", "assets", "js", "homepage.js"),
  "utf8",
);

function loadHomepage({ runScripts = true, storage = null } = {}) {
  const window = new JSDOM(html, {
    url: "https://hermesatlas.com/",
    runScripts: "dangerously",
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error("network disabled in test"));
      if (storage !== null) {
        try {
          win.localStorage.setItem("hermes-chat-history-v1", JSON.stringify(storage));
        } catch {}
      }
    },
  }).window;
  if (runScripts) window.eval(appJs);
  return window;
}

function press(window, key, opts = {}) {
  window.document.dispatchEvent(
    new window.KeyboardEvent("keydown", { key, bubbles: true, ...opts }),
  );
}

// ── Dialog semantics ──

test("chat panel declares dialog semantics and a labelled title", () => {
  const { document } = loadHomepage({ runScripts: false });
  const panel = document.getElementById("chat-panel");

  assert.equal(panel.getAttribute("role"), "dialog");
  assert.equal(panel.getAttribute("aria-modal"), "true");
  const labelledBy = panel.getAttribute("aria-labelledby");
  assert.ok(labelledBy, "panel must be labelled by its heading");
  assert.ok(document.getElementById(labelledBy), "aria-labelledby must resolve");
});

test("trigger advertises and tracks expanded state", () => {
  const window = loadHomepage();
  const { document } = window;
  const btn = document.getElementById("chat-btn");

  assert.equal(btn.getAttribute("aria-controls"), "chat-panel");
  assert.equal(btn.getAttribute("aria-expanded"), "false");

  btn.click();
  assert.equal(btn.getAttribute("aria-expanded"), "true");

  btn.click();
  assert.equal(btn.getAttribute("aria-expanded"), "false");
});

test("streamed answers are announced without re-reading the transcript", () => {
  const { document } = loadHomepage({ runScripts: false });
  const messages = document.getElementById("chat-messages");

  assert.equal(messages.getAttribute("aria-live"), "polite");
  assert.equal(messages.getAttribute("aria-atomic"), "false");
});

// ── Keyboard behavior ──

test("Escape closes the panel and returns focus to the trigger", () => {
  const window = loadHomepage();
  const { document } = window;
  const btn = document.getElementById("chat-btn");
  const panel = document.getElementById("chat-panel");

  btn.click();
  assert.ok(panel.classList.contains("open"));

  press(window, "Escape");
  assert.ok(!panel.classList.contains("open"), "Escape must close the panel");
  assert.equal(btn.getAttribute("aria-expanded"), "false");
  assert.equal(document.activeElement, btn, "focus must return to the trigger");
});

test("Escape is inert while the panel is closed", () => {
  const window = loadHomepage();
  const { document } = window;
  const panel = document.getElementById("chat-panel");

  assert.ok(!panel.classList.contains("open"));
  press(window, "Escape"); // must not throw or toggle anything
  assert.ok(!panel.classList.contains("open"));
});

test("Tab is trapped inside the open panel", () => {
  const window = loadHomepage();
  const { document } = window;
  document.getElementById("chat-btn").click();

  const panel = document.getElementById("chat-panel");
  const items = Array.from(
    panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'),
  );
  assert.ok(items.length >= 2, "panel needs multiple focusables to trap");
  const first = items[0];
  const last = items[items.length - 1];

  // Forward from the last element wraps to the first.
  last.focus();
  press(window, "Tab");
  assert.equal(document.activeElement, first);

  // Backward from the first wraps to the last.
  first.focus();
  press(window, "Tab", { shiftKey: true });
  assert.equal(document.activeElement, last);
});

test("focus that drifted outside the panel is pulled back on Tab", () => {
  const window = loadHomepage();
  const { document } = window;
  document.getElementById("chat-btn").click();

  document.body.focus();
  press(window, "Tab");
  assert.ok(
    document.getElementById("chat-panel").contains(document.activeElement),
    "focus must be recaptured into the dialog",
  );
});

// ── Empty state ──

test("starter questions show on a fresh session and are real, sendable prompts", () => {
  const { document } = loadHomepage();
  const starters = document.getElementById("chat-starters");

  assert.ok(starters, "starter container must exist");
  assert.equal(starters.hidden, false, "starters show when there is no history");

  const buttons = starters.querySelectorAll(".chat-starter");
  assert.ok(buttons.length >= 3, "offer at least three starting points");
  for (const b of buttons) {
    assert.ok(b.textContent.trim().length > 0, "starter must have visible text");
  }
});

test("starter click populates the input with its question", () => {
  const { document } = loadHomepage();
  document.getElementById("chat-btn").click();

  const starter = document.querySelector(".chat-starter");
  const expected = starter.textContent.trim();
  starter.click();

  // sendMessage() reads and clears the input, and the fetch stub rejects, so
  // assert the question was routed rather than inspecting the cleared field.
  const userMsgs = document.querySelectorAll(".chat-msg.chat-user");
  assert.equal(userMsgs.length, 1, "clicking a starter must send it");
  assert.equal(userMsgs[0].textContent.trim(), expected);
});

test("starters hide once a conversation exists", () => {
  const { document } = loadHomepage({
    storage: [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ],
  });
  assert.equal(
    document.getElementById("chat-starters").hidden,
    true,
    "starters must not compete with a restored transcript",
  );
});

// ── Citations ──

test("restored history renders cited sources as links", () => {
  const { document } = loadHomepage({
    storage: [
      { role: "user", content: "how do I install it?" },
      {
        role: "assistant",
        content: "Run the install script.",
        sources: [
          {
            url: "https://hermes-agent.nousresearch.com/docs/getting-started/quickstart",
            label: "Quickstart",
            kind: "Hermes docs",
          },
        ],
      },
    ],
  });

  const link = document.querySelector(".chat-sources a");
  assert.ok(link, "a cited source must render as a link");
  assert.equal(link.getAttribute("href"), "https://hermes-agent.nousresearch.com/docs/getting-started/quickstart");
  assert.equal(link.textContent, "Quickstart");
  assert.equal(link.getAttribute("rel"), "noopener noreferrer");
  assert.equal(link.getAttribute("target"), "_blank");
});

test("a message with no sources renders no citation block", () => {
  const { document } = loadHomepage({
    storage: [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello", sources: [] },
    ],
  });
  assert.equal(document.querySelector(".chat-sources"), null);
});

// Source labels originate from chunk paths. Rendering them via createElement
// (not innerHTML) means a hostile label is inert text, and the scheme guard
// keeps javascript: URLs out of href entirely.
test("citation rendering neutralizes hostile labels and non-https URLs", () => {
  const { document } = loadHomepage({
    storage: [
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: "answer",
        sources: [
          { url: "javascript:alert(1)", label: "bad" },
          { url: "http://insecure.example/doc", label: "insecure" },
          { url: "https://hermesatlas.com/guide/", label: "<img src=x onerror=alert(1)>" },
        ],
      },
    ],
  });

  const links = document.querySelectorAll(".chat-sources a");
  assert.equal(links.length, 1, "only the https source may render");
  assert.equal(links[0].getAttribute("href"), "https://hermesatlas.com/guide/");
  assert.equal(links[0].querySelector("img"), null, "label must not become markup");
  assert.equal(links[0].textContent, "<img src=x onerror=alert(1)>");
});
