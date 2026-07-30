/**
 * Map a RAG chunk `source` to a public URL, so Ask the Atlas can cite its
 * sources as links.
 *
 * Only *published* documentation resolves. The corpus also holds Atlas-internal
 * research (`research/NN-*.md`, `repos/*.md`, `ECOSYSTEM.md`) that has no reader-
 * facing page; those return null and the caller drops them rather than inventing
 * a destination. That is ~9% of chunks — the docs mirror is the overwhelming
 * majority and maps cleanly.
 *
 * Every mapping below was verified to return HTTP 200 before being added. If a
 * new source prefix enters the corpus it stays uncited until it is mapped here,
 * which is the safe direction: a missing citation is recoverable, a broken one
 * is not.
 */

const UPSTREAM_DOCS = "https://hermes-agent.nousresearch.com/docs";
const ATLAS = "https://hermesatlas.com";

// Terms that must not be sentence-cased. Without this, real doc paths render
// as "Cli Commands" and "Faq" in the citation list.
const ACRONYMS = new Map(
  [
    "ACP", "AI", "API", "CLI", "CI", "CPU", "CN", "CSS", "DNS", "FAQ", "GPU",
    "GPT", "HTTP", "HTTPS", "IDE", "JSON", "LLM", "MCP", "OAuth", "RAG", "REST",
    "RL", "SDK", "SQL", "SSH", "SSE", "TTS", "UI", "URL", "UX", "VS", "YAML",
  ].map((a) => [a.toLowerCase(), a]),
);

function titleize(segment) {
  return segment
    .replace(/\.md$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => {
      const known = ACRONYMS.get(word.toLowerCase());
      if (known) return known;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * @returns {{url: string, label: string, kind: string} | null}
 */
export function resolveSourceUrl(source) {
  if (typeof source !== "string" || !source) return null;
  const clean = source.trim();
  if (!clean || clean.includes("..")) return null;

  // Upstream Hermes docs mirror — the canonical home for these pages is Nous's
  // docs site, not Atlas, so cite there.
  if (clean.startsWith("research/docs/")) {
    const path = clean.slice("research/docs/".length).replace(/\.md$/i, "");
    if (!path) return null;
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0) return null;
    return {
      url: `${UPSTREAM_DOCS}/${segments.join("/")}`,
      label: titleize(segments[segments.length - 1]),
      kind: "Hermes docs",
    };
  }

  // Atlas-published pages. These sources are already URL paths (they are
  // recorded with a trailing slash by build-chunks), not file paths.
  if (clean === "guide/" || clean.startsWith("guide/")) {
    const path = clean.replace(/\/+$/, "");
    const segments = path.split("/").filter(Boolean);
    return {
      url: `${ATLAS}/${segments.join("/")}/`,
      label: segments.length > 1 ? titleize(segments[segments.length - 1]) : "Hermes Agent guide",
      kind: "Atlas guide",
    };
  }

  if (clean.startsWith("use-cases/")) {
    const path = clean.replace(/\/+$/, "");
    const segments = path.split("/").filter(Boolean);
    if (segments.length < 2) return null;
    return {
      url: `${ATLAS}/${segments.join("/")}/`,
      label: titleize(segments[segments.length - 1]),
      kind: "Atlas use case",
    };
  }

  // research/NN-*.md, repos/*.md, ECOSYSTEM.md — real sources, but no public
  // page to point a reader at. Deliberately uncited.
  return null;
}

/**
 * Reduce retrieved chunks to a short, de-duplicated citation list.
 * Order is preserved (chunks arrive ranked), so the strongest match leads.
 */
export function collectSourceLinks(chunks, limit = 4) {
  const seen = new Set();
  const out = [];
  for (const chunk of chunks || []) {
    const resolved = resolveSourceUrl(chunk?.source);
    if (!resolved || seen.has(resolved.url)) continue;
    seen.add(resolved.url);
    out.push(resolved);
    if (out.length >= limit) break;
  }
  return out;
}
