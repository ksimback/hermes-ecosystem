const OFFICIAL_DOC_PREFIX = "research/docs/";
const CURATED_PREFIX = "research/";
const REPO_PREFIX = "repos/";

const SKILLS_TERMS = [
  "skill", "skills", "skills hub", "catalog", "registry", "source", "sources",
  "install skill", "clawhub", "skills.sh", "browse.sh", "openai skills", "anthropic skills",
  "huggingface", "lobehub",
];

const TUI_SESSION_TERMS = [
  "tui", "session", "sessions", "switch session", "session switch", "orchestrator",
  "active session", "launch session", "close session", "model pick", "model picker",
  "+new", "ink tui",
];

function textFor(chunk) {
  return `${chunk?.source || ""}\n${chunk?.section || ""}\n${chunk?.text || ""}`.toLowerCase();
}

function queryHasAny(query, terms) {
  const q = String(query || "").toLowerCase();
  return terms.some((term) => q.includes(term));
}

function isSkillsCatalog(chunk) {
  const haystack = textFor(chunk);
  const source = String(chunk?.source || "").toLowerCase();
  return (
    source.includes("research/docs/skills") ||
    source.includes("skills/index") ||
    source.endsWith("/skills.md") ||
    (haystack.includes("skills hub") && (haystack.includes("source pill") || haystack.includes("catalog"))) ||
    haystack.includes("skills.sh") ||
    haystack.includes("clawhub") ||
    haystack.includes("browse.sh")
  );
}

function isTuiSessionFeature(chunk) {
  const haystack = textFor(chunk);
  return (
    haystack.includes("tui") &&
    (haystack.includes("session") || haystack.includes("orchestrator") || haystack.includes("+new"))
  );
}

export function classifyChunkSource(chunk) {
  const source = String(chunk?.source || "");
  const existing = chunk?.metadata || {};
  let authority = "community";
  let contentKind = "general";

  if (source.startsWith(OFFICIAL_DOC_PREFIX)) {
    authority = "official_docs";
  } else if (source.startsWith(CURATED_PREFIX)) {
    authority = "curated_atlas";
  } else if (source.startsWith(REPO_PREFIX) || source === "ECOSYSTEM.md") {
    authority = "atlas_data";
  }

  if (isSkillsCatalog(chunk)) {
    contentKind = "catalog";
  } else if (source.startsWith(REPO_PREFIX) || source === "ECOSYSTEM.md") {
    contentKind = "repo_metadata";
  } else if (isTuiSessionFeature(chunk)) {
    contentKind = "product_feature";
  }

  return {
    ...existing,
    authority: existing.authority || authority,
    contentKind: existing.contentKind || contentKind,
    official: existing.official ?? authority === "official_docs",
  };
}

export function sourceAuthorityBoost(chunk) {
  const meta = classifyChunkSource(chunk);
  if (meta.authority === "official_docs") return 0.12;
  if (meta.authority === "curated_atlas") return 0.10;
  if (meta.authority === "atlas_data") return 0.03;
  return 0;
}

export function querySourceAdjustment(query, chunk) {
  const meta = classifyChunkSource(chunk);
  let adjustment = 0;

  if (meta.contentKind === "catalog") {
    adjustment += queryHasAny(query, SKILLS_TERMS) ? 0.10 : -0.07;
  }

  if (isTuiSessionFeature(chunk)) {
    adjustment += queryHasAny(query, TUI_SESSION_TERMS) ? 0.08 : 0;
  }

  // Official docs are preferred for operational/how-to queries, but keep this
  // small so semantic/BM25 relevance still dominates.
  if (meta.authority === "official_docs" && /\b(how|install|configure|setup|use|docs?|official)\b/i.test(query || "")) {
    adjustment += 0.03;
  }

  return adjustment;
}

export function combinedRetrievalScore({ query, chunk, normCosine, normBM25 }) {
  return (
    0.65 * normCosine +
    0.25 * normBM25 +
    sourceAuthorityBoost(chunk) +
    querySourceAdjustment(query, chunk)
  );
}

export function enrichChunkMetadata(chunk) {
  return {
    ...chunk,
    metadata: classifyChunkSource(chunk),
  };
}
