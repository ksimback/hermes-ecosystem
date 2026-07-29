(function () {
  // ── Free-text "I want to build X" matcher (/use-cases/) ──
  // Progressive enhancement: the index page ships every use case in the HTML and
  // the search box is `hidden` until this file runs, so no-JS visitors get the
  // full list rather than a search field that does nothing.
  //
  // Deliberately a DOM filter over the `data-match` attribute (title + intent +
  // aliases, pre-lowercased at build time) rather than a client-side copy of the
  // catalog: zero payload, zero network, and it can never disagree with the page
  // it is filtering.

  const input = document.getElementById('uc-search');
  const wrap = document.getElementById('uc-search-wrap');
  const list = document.getElementById('uc-list');
  const empty = document.getElementById('uc-search-empty');
  if (!input || !wrap || !list) return;

  const rows = Array.from(list.querySelectorAll('.uc-index-row'));
  if (rows.length === 0) return;

  // data-match is pre-lowercased at build time (title + intent + aliases).
  const rowWords = new WeakMap();
  for (const row of rows) {
    rowWords.set(
      row,
      new Set((row.getAttribute('data-match') || '').split(/[^a-z0-9+]+/).filter(Boolean))
    );
  }

  wrap.hidden = false;

  // Words that appear in nearly every intent phrasing and would otherwise let a
  // query match everything. Dropping them is what makes "I want to build a
  // telegram bot" behave like "telegram bot".
  const STOP_WORDS = new Set([
    'i', 'a', 'an', 'the', 'to', 'my', 'me', 'want', 'wants', 'wanted', 'need',
    'needs', 'build', 'building', 'make', 'making', 'get', 'have', 'for', 'with',
    'and', 'or', 'of', 'on', 'in', 'it', 'that', 'this', 'how', 'do', 'can',
    'hermes', 'agent', 'something', 'some', 'like',
  ]);

  function terms(query) {
    return query
      .toLowerCase()
      .split(/[^a-z0-9+]+/)
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
  }

  // Whole-word first, with prefix matching only for terms long enough to be
  // specific. Plain substring matching scores "minecraft mod" against "models",
  // which is how a matcher ends up recommending confidently irrelevant stacks.
  const MIN_PREFIX_LEN = 5;

  function matches(words, term) {
    if (words.has(term)) return true;
    if (term.length < MIN_PREFIX_LEN) return false;
    for (const word of words) {
      // "forgetting" ↔ "forget", "deployment" ↔ "deploy" — either direction,
      // but only when the shorter side is itself a specific-enough stem.
      if (word.startsWith(term)) return true;
      if (word.length >= MIN_PREFIX_LEN && term.startsWith(word)) return true;
    }
    return false;
  }

  function score(words, queryTerms) {
    let hits = 0;
    for (const term of queryTerms) {
      if (matches(words, term)) hits++;
    }
    return hits;
  }

  function reset() {
    for (const row of rows) row.hidden = false;
    // Restore the authored order — the build emits them in curation order.
    for (const row of rows) list.appendChild(row);
    if (empty) empty.hidden = true;
  }

  function apply() {
    const queryTerms = terms(input.value);
    if (queryTerms.length === 0) {
      reset();
      return;
    }

    const scored = rows.map((row, index) => ({
      row,
      index,
      score: score(rowWords.get(row), queryTerms),
    }));

    const matches = scored.filter((s) => s.score > 0);

    if (matches.length === 0) {
      // Show everything rather than an empty page, and point at the chatbot,
      // which can search the whole catalog instead of these 12 bundles.
      for (const { row } of scored) row.hidden = false;
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;
    for (const { row, score: s } of scored) row.hidden = s === 0;

    // Best match first; ties keep curation order so the ranking is stable.
    matches
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .forEach(({ row }) => list.appendChild(row));
  }

  let frame = 0;
  input.addEventListener('input', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(apply);
  });

  // Enter on a single match is the fast path for someone who typed a precise phrase.
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const visible = rows.filter((row) => !row.hidden);
    if (visible.length === 1) window.location.href = visible[0].href;
  });
})();
