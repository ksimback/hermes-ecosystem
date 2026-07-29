// Deterministic use-case matching for the chat path.
//
// Mirrors the client-side matcher in assets/js/use-cases.js on purpose: the
// /use-cases/ page and Ask the Atlas should not disagree about which bundle a
// phrase means. Kept dependency-free and side-effect-free so it can be unit
// tested without booting the chat handler.
//
// Why this exists: api/chat.js used to answer every ranking/recommendation
// query by injecting the ENTIRE catalog (217 repos ≈ 7,900 tokens) and asking
// the model to re-rank it. That is expensive on a query class where a curated
// bundle is both cheaper and a better answer.

export const STOP_WORDS = new Set([
  "i", "a", "an", "the", "to", "my", "me", "want", "wants", "wanted", "need",
  "needs", "build", "building", "make", "making", "get", "have", "for", "with",
  "and", "or", "of", "on", "in", "it", "that", "this", "how", "do", "can",
  "hermes", "agent", "something", "some", "like", "should", "use", "using",
  "best", "good", "any", "there", "are", "is", "what", "which", "recommend",
]);

// Prefix matching only kicks in for terms long enough to be specific —
// otherwise "minecraft mod" scores against "models".
export const MIN_PREFIX_LEN = 5;

export function terms(query) {
  return String(query || "")
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

export function wordsOf(text) {
  return new Set(
    String(text || "")
      .toLowerCase()
      .split(/[^a-z0-9+]+/)
      .filter(Boolean)
  );
}

export function matchesTerm(words, term) {
  if (words.has(term)) return true;
  if (term.length < MIN_PREFIX_LEN) return false;
  for (const word of words) {
    if (word.startsWith(term)) return true;
    if (word.length >= MIN_PREFIX_LEN && term.startsWith(word)) return true;
  }
  return false;
}

/**
 * Score a query against use-case bundles.
 *
 * Threshold is `minScore` matching terms, OR one term that is *itself a curated
 * alias* of exactly one bundle. Requiring two matches unconditionally rejected
 * the most canonical query there is ("I want to build a telegram bot" → only
 * "telegram" survives stop-word removal).
 *
 * Rarity alone is NOT enough to carry a single-term match: "server" appears in
 * exactly one bundle (inside the alias "home server agent") but is generic, and
 * accepting it made "minecraft mod for my server" recommend a personal-ops
 * stack. An alias is a phrase a curator deliberately wrote down as a way people
 * ask for this bundle, so a query term that *equals* one is a real signal in a
 * way that a word merely buried inside one is not.
 *
 * @returns {Array<{useCase: object, score: number}>} best first, ties keep curation order
 */
export function matchUseCases(query, useCases, { minScore = 2, limit = 2 } = {}) {
  const queryTerms = terms(query);
  if (queryTerms.length === 0 || !Array.isArray(useCases) || useCases.length === 0) return [];

  const wordSets = useCases.map((useCase) =>
    wordsOf([useCase.title, useCase.intent, ...(useCase.aliases || [])].join(" "))
  );

  // Document frequency per query term, across bundles.
  const df = new Map();
  for (const term of queryTerms) {
    df.set(term, wordSets.reduce((n, words) => n + (matchesTerm(words, term) ? 1 : 0), 0));
  }

  return useCases
    .map((useCase, index) => {
      const words = wordSets[index];
      const matched = queryTerms.filter((t) => matchesTerm(words, t));
      const aliases = new Set((useCase.aliases || []).map((a) => String(a).trim().toLowerCase()));
      // Both conditions: the term is a curated alias of THIS bundle, and it
      // doesn't also match any other bundle.
      const distinctive = matched.some((t) => aliases.has(t) && df.get(t) === 1);
      return { useCase, score: matched.length, distinctive, index };
    })
    .filter((m) => m.score >= minScore || (m.score >= 1 && m.distinctive))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ useCase, score }) => ({ useCase, score }));
}

// Category synonyms used to narrow the catalog dump. Deliberately omits
// "Developer Tools", "Domain Applications" and "Core & Official" — their
// natural-language signals ("tool", "app", "official") are too generic and
// would narrow queries that legitimately span the whole catalog.
export const CATEGORY_SIGNALS = {
  "Memory & Context": [
    "memory", "memories", "remember", "remembers", "recall", "context",
    "forget", "forgets", "forgetting", "compaction", "persistence",
  ],
  "Workspaces & GUIs": [
    "gui", "guis", "ui", "workspace", "workspaces", "desktop", "dashboard",
    "interface", "webui", "tui", "frontend",
  ],
  "Skills & Skill Registries": ["skill", "skills", "skillset", "registry", "registries"],
  "Deployment & Infra": [
    "deploy", "deployment", "docker", "kubernetes", "k8s", "helm", "vps",
    "hosting", "selfhost", "nix", "systemd", "server",
  ],
  "Multi-Agent & Orchestration": [
    "orchestration", "orchestrator", "swarm", "fleet", "kanban", "multiagent", "subagents",
  ],
  "Integrations & Bridges": [
    "integration", "integrations", "bridge", "bridges", "connector", "telegram",
    "discord", "whatsapp", "signal", "slack", "imessage", "wechat", "feishu",
  ],
  "Plugins & Extensions": ["plugin", "plugins", "extension", "extensions"],
  "Guides & Docs": ["guide", "guides", "tutorial", "tutorials", "documentation", "docs"],
  "Forks & Derivatives": ["fork", "forks", "derivative", "derivatives"],
};

/**
 * Infer a single catalog category from a query, but ONLY when the signal is
 * unambiguous. Zero or multiple matching categories returns null, which keeps
 * the caller on the full-catalog fallback — a wrong narrowing starves a
 * legitimate cross-category ranking question, which is worse than paying the
 * tokens.
 * @returns {string|null}
 */
export function inferCategory(query, signals = CATEGORY_SIGNALS) {
  const queryTerms = terms(query);
  if (queryTerms.length === 0) return null;

  const hits = [];
  for (const [category, words] of Object.entries(signals)) {
    const set = new Set(words);
    if (queryTerms.some((t) => set.has(t))) hits.push(category);
  }
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Compact prompt block for matched bundles. Includes star counts so the
 * assistant's "always cite exact star counts when recommending" rule still
 * holds without the full catalog present.
 */
export function buildUseCaseBlock(matches, repoIndex) {
  if (!matches || matches.length === 0) return "";

  const body = matches
    .map(({ useCase }) => {
      const stack = useCase.stack
        .map((item) => {
          const repo = repoIndex.get(`${item.owner}/${item.repo}`);
          const stars = repo ? ` (★ ${repo.stars})` : "";
          const category = repo ? ` [${repo.category}]` : "";
          return `  - ${item.role}: **${item.owner}/${item.repo}**${stars}${category} — ${item.why}`;
        })
        .join("\n");
      const caveats = (useCase.caveats || []).length
        ? `\n  Caveats: ${useCase.caveats.join(" ")}`
        : "";
      const gaps = (useCase.gaps || []).length
        ? `\n  Known gaps: ${useCase.gaps.join(" ")}`
        : "";
      return `### ${useCase.title}\nIntent: ${useCase.intent}\nAtlas page: https://hermesatlas.com/use-cases/${useCase.slug}\nStack:\n${stack}\n  Why: ${useCase.rationale}${caveats}${gaps}`;
    })
    .join("\n\n");

  return `\n\n## USE-CASE BUNDLES (curated stacks matching this question)\n${body}\n`;
}
