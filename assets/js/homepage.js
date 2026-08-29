(function() {
  // ── Theme toggle ──
  function renderThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    const current = document.documentElement.getAttribute('data-theme');
    const isLight = current === 'light';
    toggle.querySelector('.tt-light').classList.toggle('tt-active', isLight);
    toggle.querySelector('.tt-dark').classList.toggle('tt-active', !isLight);
    toggle.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
    toggle.setAttribute('title', isLight ? 'Switch to dark theme' : 'Switch to light theme');
  }
  renderThemeToggle();

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      renderThemeToggle();
    });
  }

  // ── Report banner dismiss ──
  const reportBanner = document.getElementById('report-banner');
  const reportBannerClose = document.getElementById('report-banner-close');
  const BANNER_DISMISSED_KEY = 'hermes-banner-dismissed-state-of-hermes-july-2026';

  if (reportBanner) {
    try {
      if (localStorage.getItem(BANNER_DISMISSED_KEY)) {
        reportBanner.classList.add('hidden');
      }
    } catch {}
  }
  if (reportBannerClose) {
    reportBannerClose.addEventListener('click', () => {
      reportBanner.classList.add('hidden');
      try { localStorage.setItem(BANNER_DISMISSED_KEY, '1'); } catch {}
    });
  }

  // ── Live ecosystem stats (masthead meta + stats row) ──
  // Repo-row star/delta/trending updates moved to /assets/js/ecosystem.js
  // with the catalog (homepage redesign) — this page only shows aggregates.
  async function fetchStars() {
    try {
      const [starsRes, historyRes] = await Promise.all([
        fetch('/api/stars'),
        fetch('/api/stars-history?days=30').catch(() => null)
      ]);

      if (!starsRes.ok) return;
      const data = await starsRes.json();

      let history = null;
      let historyIsFresh = false;
      if (historyRes && historyRes.ok) {
        const histData = await historyRes.json();
        history = histData.history || [];
        historyIsFresh = histData.stale === false;
      }

      if (data.stale) {
        console.warn('[stars] displaying a stale snapshot:', data.degradedReason || data.source);
      }

      const timeSeries = {};
      if (historyIsFresh && history && history.length > 0) {
        for (const snapshot of history) {
          for (const [key, stars] of Object.entries(snapshot.data || {})) {
            if (!timeSeries[key]) timeSeries[key] = [];
            timeSeries[key].push(stars);
          }
        }
      }

      // Require 8 snapshots (= 7 full days, since cron runs daily) before
      // counting a repo toward weekly growth — sparse history mislabels
      // "since first snapshot" as "weekly" and inflates the number.
      let sumDelta = 0;
      for (const series of Object.values(timeSeries)) {
        if (series.length < 8) continue;
        const delta = series[series.length - 1] - series[series.length - 8];
        if (delta > 0) sumDelta += delta;
      }

      // Stats row
      if (data.totals) {
        const totalStars = document.getElementById('stat-total-stars');
        if (totalStars) totalStars.textContent = formatStars(data.totals.stars);
        const totalRepos = document.getElementById('stat-total-repos');
        if (totalRepos) totalRepos.textContent = data.totals.count;
        const weekEl = document.getElementById('stat-week-delta');
        if (weekEl) weekEl.textContent = sumDelta > 0 ? '+' + formatStars(sumDelta) : '—';
      }

      // Masthead meta
      const metaCount = document.getElementById('meta-count');
      if (metaCount && data.totals?.count) metaCount.textContent = data.totals.count + '·repos';

      // Version is set by fetchVersion() from the authoritative release notes,
      // not from /api/stars (whose GraphQL release field can null out / cache-lag).

      const metaAtlas = document.getElementById('meta-atlas');
      if (metaAtlas && data.atlas?.stars) {
        metaAtlas.textContent = '★ ' + data.atlas.stars + ' · star this repo';
      }

      // Hero sub count
      const heroSubCount = document.getElementById('hero-sub-count');
      if (heroSubCount && data.totals?.count) heroSubCount.textContent = data.totals.count;
    } catch (e) {
      console.log('Stars API unavailable, using static counts', e);
    }
  }

  // Hermes version, sourced from the authoritative release notes
  // (data/latest-release.json) — a small static file that's always fresh and
  // independent of the /api/stars GraphQL/cache path that stranded the version
  // at a stale value. Static baked spans are the pre-JS fallback.
  async function fetchVersion() {
    try {
      const res = await fetch('/data/latest-release.json');
      if (!res.ok) return;
      const r = await res.json();
      if (!r || !r.version) return;
      const mv = document.getElementById('meta-version');
      if (mv) mv.textContent = 'hermes·' + r.version;
      const hv = document.getElementById('hero-version');
      if (hv) hv.textContent = r.version;
      const ht = document.getElementById('hero-version-tag');
      if (ht && r.tag) ht.textContent = r.tag;
    } catch (e) {
      console.log('Version unavailable', e);
    }
  }

  function formatStars(n) {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  fetchStars();
  fetchVersion();

  // ── Chat Widget ──
  const chatBtn = document.getElementById('chat-btn');
  const chatPanel = document.getElementById('chat-panel');
  const chatClose = document.getElementById('chat-close');
  const chatClear = document.getElementById('chat-clear');
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');
  const chatMessages = document.getElementById('chat-messages');

  const CHAT_STORAGE_KEY = 'hermes-chat-history-v1';
  const CHAT_MAX_SAVED = 30;
  const WELCOME_MSG = "hi — i'm the hermes atlas assistant. ask me anything about hermes agent: tools, skills, comparisons, setup.";

  let chatHistory = [];

  function loadChatHistory() {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed;
    } catch { return null; }
  }

  function saveChatHistory() {
    try {
      const trimmed = chatHistory.slice(-CHAT_MAX_SAVED);
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
      // Previously `catch {}` swallowed everything — including
      // QuotaExceededError on full-storage devices, where the user's
      // chat history would silently vanish on reload. Logging gives at
      // least a console signal so this isn't invisible if it ever fires.
      if (e?.name === 'QuotaExceededError') {
        console.warn('[chat] localStorage quota exceeded — chat history will not persist this session');
      }
    }
  }

  function clearChatHistory() {
    chatHistory = [];
    try { localStorage.removeItem(CHAT_STORAGE_KEY); } catch {}
    chatMessages.innerHTML = '';
    appendStaticMessage('assistant', WELCOME_MSG);
    syncStarters();
  }

  // Citations come from the API's meta trailer, already filtered to published
  // pages with resolved URLs (lib/source-links.js). Built with createElement
  // rather than innerHTML so a source label can never inject markup.
  function appendSources(el, sources) {
    if (!Array.isArray(sources) || sources.length === 0) return;
    const wrap = document.createElement('div');
    wrap.className = 'chat-sources';

    const label = document.createElement('span');
    label.className = 'chat-sources-label';
    label.textContent = 'sources';
    wrap.appendChild(label);

    const list = document.createElement('ul');
    for (const src of sources) {
      if (!src || typeof src.url !== 'string') continue;
      // Defense in depth: only ever render http(s) destinations.
      if (!/^https:\/\//i.test(src.url)) continue;
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = src.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = src.label || src.url;
      if (src.kind) a.title = src.kind + ' — ' + src.url;
      li.appendChild(a);
      list.appendChild(li);
    }
    if (!list.children.length) return;
    wrap.appendChild(list);
    el.appendChild(wrap);
  }

  function appendModelBadge(el, modelUsed) {
    if (!modelUsed) return;
    const badge = document.createElement('div');
    badge.className = 'chat-model-badge';
    badge.textContent = formatModelName(modelUsed);
    badge.title = 'Answered by ' + modelUsed;
    el.appendChild(badge);
  }

  function appendStaticMessage(role, text, modelUsed, sources) {
    const el = document.createElement('div');
    el.className = 'chat-msg chat-' + role;
    el.innerHTML = role === 'user' ? escapeHtml(text) : renderMarkdown(text);
    if (role === 'assistant') {
      appendSources(el, sources);
      appendModelBadge(el, modelUsed);
    }
    chatMessages.appendChild(el);
    return el;
  }

  // Starter questions are the empty state: they show only before the first
  // exchange, and disappear once there is a conversation to read.
  const chatStarters = document.getElementById('chat-starters');

  function syncStarters() {
    if (!chatStarters) return;
    chatStarters.hidden = chatHistory.length > 0;
  }

  if (chatStarters) {
    for (const btn of chatStarters.querySelectorAll('.chat-starter')) {
      btn.addEventListener('click', () => {
        chatInput.value = btn.textContent.trim();
        sendMessage();
      });
    }
  }

  function initChat() {
    const saved = loadChatHistory();
    if (saved && saved.length > 0) {
      chatHistory = saved;
      appendStaticMessage('assistant', WELCOME_MSG);
      for (const msg of saved) {
        appendStaticMessage(msg.role, msg.content, msg.model, msg.sources);
      }
    } else {
      appendStaticMessage('assistant', WELCOME_MSG);
    }
    syncStarters();
  }
  initChat();

  // ── Panel open/close, focus management ──
  // The panel is a modal dialog: while it is open, Tab must not escape into the
  // page behind it, Escape must close it, and focus must return to the trigger
  // so a keyboard user is not dumped at the top of the document.
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

  function chatIsOpen() {
    return chatPanel.classList.contains('open');
  }

  function focusableInPanel() {
    // Deliberately not an offsetParent check: the panel is position:fixed, so
    // offsetParent is null for it and every descendant, which would leave the
    // trap with nothing to cycle through. The only conditional visibility in
    // here is the `hidden` attribute on the starters block, so test for that.
    return Array.from(chatPanel.querySelectorAll(FOCUSABLE)).filter(
      (el) => !el.disabled && !el.closest('[hidden]'),
    );
  }

  function openChat() {
    chatPanel.classList.add('open');
    if (chatBtn) chatBtn.setAttribute('aria-expanded', 'true');
    syncStarters();
    chatInput.focus();
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function closeChat({ restoreFocus = true } = {}) {
    if (!chatIsOpen()) return;
    chatPanel.classList.remove('open');
    if (chatBtn) {
      chatBtn.setAttribute('aria-expanded', 'false');
      if (restoreFocus) chatBtn.focus();
    }
  }

  if (chatBtn) {
    chatBtn.addEventListener('click', () => {
      if (chatIsOpen()) closeChat();
      else openChat();
    });
    chatClose.addEventListener('click', () => closeChat());
  }

  document.addEventListener('keydown', (e) => {
    if (!chatIsOpen()) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeChat();
      return;
    }

    if (e.key !== 'Tab') return;
    const items = focusableInPanel();
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];

    // Wrap at both ends. Also catches the case where focus has drifted outside
    // the panel entirely (e.g. a click on the page behind it).
    if (!chatPanel.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  if (chatClear) {
    chatClear.addEventListener('click', () => {
      if (chatHistory.length === 0 || confirm('clear conversation history?')) {
        clearChatHistory();
        chatInput.focus();
      }
    });
  }

  // Visible "working" state. Replaces the old 'searching the research...'
  // text, which a screen reader read as if it were the answer.
  function buildLoadingSkeleton() {
    const wrap = document.createElement('span');
    wrap.className = 'chat-loading-dots';
    for (let i = 0; i < 3; i++) wrap.appendChild(document.createElement('i'));
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = 'searching the research…';
    wrap.appendChild(sr);
    return wrap;
  }

  async function sendMessage() {
    const msg = chatInput.value.trim();
    if (!msg) return;

    appendMessage('user', msg);
    chatInput.value = '';
    chatHistory.push({ role: 'user', content: msg });
    saveChatHistory();

    syncStarters();

    chatSend.disabled = true;
    chatInput.disabled = true;
    const loadingEl = appendMessage('assistant', '');
    loadingEl.classList.add('loading');
    // Announce that work is in flight without narrating every streamed token.
    loadingEl.setAttribute('aria-busy', 'true');
    loadingEl.appendChild(buildLoadingSkeleton());

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: chatHistory.slice(-6) }),
        signal: controller.signal
      });

      if (!res.ok) {
        clearTimeout(timeoutId);
        if (res.headers.get('content-type')?.includes('application/json')) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error ' + res.status);
        }
        throw new Error('Error ' + res.status + '. Please try again.');
      }

      if (!res.body) {
        clearTimeout(timeoutId);
        throw new Error('Empty response body. Please try again.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let firstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const cleaned = chunk.replace(/​/g, '');
        if (!cleaned) continue;

        if (firstChunk) {
          loadingEl.textContent = '';
          loadingEl.classList.remove('loading');
          firstChunk = false;
        }

        fullResponse += cleaned;
        const displayText = fullResponse.replace(/‎__META__.*?__META__‎/, '');
        loadingEl.innerHTML = renderMarkdown(displayText);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }

      clearTimeout(timeoutId);

      let modelUsed = null;
      let sources = null;
      const trailerMatch = fullResponse.match(/‎__META__(.*?)__META__‎/);
      if (trailerMatch) {
        try {
          const meta = JSON.parse(trailerMatch[1]);
          modelUsed = meta.model;
          if (Array.isArray(meta.sources)) sources = meta.sources;
        } catch {}
        fullResponse = fullResponse.replace(trailerMatch[0], '');
      }

      if (!fullResponse.trim()) throw new Error('no response received. please try again.');

      loadingEl.innerHTML = renderMarkdown(fullResponse);
      loadingEl.removeAttribute('aria-busy');
      appendSources(loadingEl, sources);
      appendModelBadge(loadingEl, modelUsed);

      chatHistory.push({ role: 'assistant', content: fullResponse, model: modelUsed, sources });
      saveChatHistory();
    } catch (e) {
      let msg = e.message || 'something went wrong. please try again.';
      if (e.name === 'AbortError') {
        msg = 'request timed out. the AI service is slow right now — please try again.';
      }
      loadingEl.textContent = msg;
      loadingEl.classList.remove('loading');
      loadingEl.removeAttribute('aria-busy');
      loadingEl.classList.add('error');
    } finally {
      chatSend.disabled = false;
      chatInput.disabled = false;
      chatInput.focus();
    }
  }

  if (chatSend) chatSend.addEventListener('click', sendMessage);
  if (chatInput) chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  function appendMessage(role, text) {
    const el = document.createElement('div');
    el.className = 'chat-msg chat-' + role;
    el.innerHTML = role === 'user' ? escapeHtml(text) : renderMarkdown(text);
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return el;
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function formatModelName(id) {
    if (!id) return '';
    let name = id.replace(/-\d{8}$/, '');
    name = name.replace(/:free$/, '');
    const parts = name.split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart.includes('gemma')) return 'powered by gemma 4';
    if (lastPart.includes('gemini')) return 'powered by gemini';
    if (lastPart.includes('hermes')) return 'powered by hermes 3';
    if (lastPart.includes('llama')) return 'powered by llama';
    if (lastPart.includes('nemotron')) return 'powered by nemotron';
    if (lastPart.includes('glm')) return 'powered by glm';
    if (lastPart.includes('claude')) return 'powered by claude';
    return 'powered by ' + lastPart;
  }

  function renderMarkdown(text) {
    // Escape HTML before applying any markdown regex. Without this, an
    // LLM that emits <script> or <img onerror=...> — whether through
    // prompt injection, RAG-poisoned context, or just an unlucky
    // generation — would execute in the user's browser via .innerHTML.
    // After escaping, only the wrappers we add below become real HTML.
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[Source: ([^\]]+)\]/g, '<span class="citation">$1</span>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
        // Whitelist URL schemes — block javascript:, data:, vbscript:.
        // The URL was already escapeHtml'd above (so quotes are safe in
        // the href attribute), but scheme validation is still required.
        if (!/^(https?:|mailto:)/i.test(url)) return match;
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      })
      .replace(/\n/g, '<br>');
  }
})();
