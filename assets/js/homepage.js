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
  const BANNER_DISMISSED_KEY = 'hermes-banner-dismissed-state-of-hermes-may-2026';

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

  // ── Tooltip ──
  const tooltip = document.getElementById('tooltip');
  const ttName = document.getElementById('tt-name');
  const ttDesc = document.getElementById('tt-desc');

  function initTooltips() {
    document.querySelectorAll('.repo-row[data-desc]').forEach(item => {
      item.addEventListener('mouseenter', e => {
        const nameEl = item.querySelector('.repo-name');
        ttName.textContent = nameEl ? nameEl.textContent.replace('official', '').trim() : '';
        ttDesc.textContent = item.getAttribute('data-desc') || '';
        tooltip.style.display = 'block';
        positionTooltip(e);
      });
      item.addEventListener('mousemove', positionTooltip);
      item.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    });
  }

  function positionTooltip(e) {
    const pad = 12;
    let x = e.clientX + pad, y = e.clientY + pad;
    const w = 340, h = tooltip.getBoundingClientRect().height || 80;
    if (x + w > window.innerWidth) x = e.clientX - w - pad;
    if (y + h > window.innerHeight) y = e.clientY - h - pad;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  }
  initTooltips();

  // ── Add data-repo attributes to repo rows ──
  document.querySelectorAll('.repo-row[data-github]').forEach(item => {
    const match = item.getAttribute('data-github').match(/github\.com\/([^/]+\/[^/]+)/);
    if (match) item.setAttribute('data-repo', match[1]);
  });

  // ── Live star counts + weekly deltas + trending ──
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

      const deltas = {};
      const growthPct = {};
      for (const [key, series] of Object.entries(timeSeries)) {
        // Require 8 snapshots (= 7 full days, since cron runs daily) before
        // showing weekly growth. Previously fell back to series[0] when
        // history was sparse, which mislabeled "since first snapshot" as
        // "weekly" — inflating trending badges during the first week of
        // tracking or after data gaps.
        if (series.length < 8) continue;
        const current = series[series.length - 1];
        const weekAgo = series[series.length - 8];
        const delta = current - weekAgo;
        deltas[key] = delta;
        if (weekAgo > 0) growthPct[key] = (delta / weekAgo) * 100;
      }

      const trendingSet = new Set(
        Object.entries(growthPct)
          .filter(([_, pct]) => pct > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([key]) => key)
      );

      // Update repo rows
      document.querySelectorAll('.repo-row[data-repo]').forEach(item => {
        const key = item.getAttribute('data-repo');
        const info = data.repos?.[key];
        if (!info) return;

        const starsEl = item.querySelector('.repo-stars');
        if (starsEl) starsEl.textContent = '★ ' + formatStars(info.stars);
        item.setAttribute('data-stars', info.stars);
        if (info.updatedAt) item.setAttribute('data-updated', info.updatedAt);

        const deltaEl = item.querySelector('.repo-delta');
        if (deltaEl) {
          const delta = deltas[key];
          if (delta === undefined) {
            deltaEl.textContent = '— / wk';
            deltaEl.className = 'repo-delta zero';
          } else if (delta === 0) {
            deltaEl.textContent = '0 / wk';
            deltaEl.className = 'repo-delta zero';
          } else if (delta > 0) {
            deltaEl.innerHTML = '+' + formatStars(delta) + ' / wk' + (trendingSet.has(key) ? '<span class="hot"> · hot</span>' : '');
            deltaEl.className = 'repo-delta';
          } else {
            deltaEl.textContent = '-' + formatStars(Math.abs(delta)) + ' / wk';
            deltaEl.className = 'repo-delta negative';
          }
        }
      });

      // Update stats row
      if (data.totals) {
        document.getElementById('stat-total-stars').textContent = formatStars(data.totals.stars);
        document.getElementById('stat-total-repos').textContent = data.totals.count;
        const sumDelta = Object.values(deltas).reduce((a, b) => a + (b > 0 ? b : 0), 0);
        const weekEl = document.getElementById('stat-week-delta');
        if (weekEl) weekEl.textContent = sumDelta > 0 ? '+' + formatStars(sumDelta) : '—';
      }

      // Update masthead meta
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

      // Featured repo numbers
      const heroStars = document.getElementById('hero-stars');
      if (heroStars && data.repos?.['NousResearch/hermes-agent']) {
        heroStars.textContent = formatStars(data.repos['NousResearch/hermes-agent'].stars);
      }
      // hero version is set by fetchVersion() (authoritative release notes).
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

  // Catalog search + sort (progressive enhancement). Reveals the controls
  // (hidden by default so no-JS users get the full browsable list) and wires
  // live text filtering + within-category sorting over the existing repo rows.
  function initCatalogControls() {
    const controls = document.getElementById('catalog-controls');
    if (!controls) return;
    const search = document.getElementById('catalog-search');
    const sortSel = document.getElementById('catalog-sort');
    const countEl = document.getElementById('catalog-result-count');
    const sections = Array.from(document.querySelectorAll('section.cat'));
    const rows = [];
    sections.forEach(sec => {
      sec.querySelectorAll('.repo-row').forEach(row => {
        const slug = (row.getAttribute('href') || '').replace('/projects/', '').toLowerCase();
        const desc = (row.getAttribute('data-desc') || '').toLowerCase();
        rows.push({ row, sec, hay: slug + ' ' + desc });
      });
    });
    const starsOf = row => {
      const attr = row.getAttribute('data-stars');
      if (attr) return parseInt(attr, 10) || 0;
      const el = row.querySelector('.repo-stars');
      return el ? parseInt(el.textContent.replace(/[^0-9]/g, ''), 10) || 0 : 0;
    };
    const nameOf = row => (row.getAttribute('href') || '').toLowerCase();
    const updatedOf = row => row.getAttribute('data-updated') || '';
    function applyFilter() {
      const q = search.value.trim().toLowerCase();
      let visible = 0;
      rows.forEach(({ row, hay }) => {
        const show = !q || hay.indexOf(q) !== -1;
        row.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      sections.forEach(sec => {
        const any = Array.from(sec.querySelectorAll('.repo-row')).some(r => r.style.display !== 'none');
        sec.style.display = any ? '' : 'none';
      });
      countEl.textContent = q ? visible + ' match' + (visible === 1 ? '' : 'es') : '';
    }
    function applySort() {
      const key = sortSel.value;
      document.querySelectorAll('.cat-list').forEach(list => {
        Array.from(list.querySelectorAll('.repo-row'))
          .sort((a, b) => {
            if (key === 'name') return nameOf(a).localeCompare(nameOf(b));
            if (key === 'active') return updatedOf(b).localeCompare(updatedOf(a));
            return starsOf(b) - starsOf(a);
          })
          .forEach(it => list.appendChild(it));
      });
    }
    search.addEventListener('input', applyFilter);
    sortSel.addEventListener('change', applySort);
    controls.hidden = false;
    applySort();
  }

  // Initialize data-stars from current star text. Must run before
  // initCatalogControls(): its initial sort reads data-stars, and its
  // text-parsing fallback can't handle "1.2K"-style abbreviations.
  document.querySelectorAll('.repo-row').forEach(item => {
    const starsEl = item.querySelector('.repo-stars');
    if (starsEl && !item.getAttribute('data-stars')) {
      const text = starsEl.textContent.replace('★', '').trim().replace(',', '');
      let val = 0;
      if (text.includes('K')) val = parseFloat(text) * 1000;
      else val = parseInt(text) || 0;
      item.setAttribute('data-stars', val);
    }
  });

  fetchStars();
  fetchVersion();
  initCatalogControls();

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
  }

  function appendStaticMessage(role, text, modelUsed) {
    const el = document.createElement('div');
    el.className = 'chat-msg chat-' + role;
    el.innerHTML = role === 'user' ? escapeHtml(text) : renderMarkdown(text);
    if (role === 'assistant' && modelUsed) {
      const badge = document.createElement('div');
      badge.className = 'chat-model-badge';
      badge.textContent = formatModelName(modelUsed);
      badge.title = 'Answered by ' + modelUsed;
      el.appendChild(badge);
    }
    chatMessages.appendChild(el);
    return el;
  }

  function initChat() {
    const saved = loadChatHistory();
    if (saved && saved.length > 0) {
      chatHistory = saved;
      appendStaticMessage('assistant', WELCOME_MSG);
      for (const msg of saved) {
        appendStaticMessage(msg.role, msg.content, msg.model);
      }
    } else {
      appendStaticMessage('assistant', WELCOME_MSG);
    }
  }
  initChat();

  if (chatBtn) {
    chatBtn.addEventListener('click', () => {
      chatPanel.classList.toggle('open');
      if (chatPanel.classList.contains('open')) {
        chatInput.focus();
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    });
    chatClose.addEventListener('click', () => chatPanel.classList.remove('open'));
  }
  if (chatClear) {
    chatClear.addEventListener('click', () => {
      if (chatHistory.length === 0 || confirm('clear conversation history?')) {
        clearChatHistory();
        chatInput.focus();
      }
    });
  }

  async function sendMessage() {
    const msg = chatInput.value.trim();
    if (!msg) return;

    appendMessage('user', msg);
    chatInput.value = '';
    chatHistory.push({ role: 'user', content: msg });
    saveChatHistory();

    chatSend.disabled = true;
    chatInput.disabled = true;
    const loadingEl = appendMessage('assistant', 'searching the research...');
    loadingEl.classList.add('loading');

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
        const cleaned = chunk.replace(/\u200B/g, '');
        if (!cleaned) continue;

        if (firstChunk) {
          loadingEl.textContent = '';
          loadingEl.classList.remove('loading');
          firstChunk = false;
        }

        fullResponse += cleaned;
        const displayText = fullResponse.replace(/\u200E__META__.*?__META__\u200E/, '');
        loadingEl.innerHTML = renderMarkdown(displayText);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }

      clearTimeout(timeoutId);

      let modelUsed = null;
      const trailerMatch = fullResponse.match(/\u200E__META__(.*?)__META__\u200E/);
      if (trailerMatch) {
        try { modelUsed = JSON.parse(trailerMatch[1]).model; } catch {}
        fullResponse = fullResponse.replace(trailerMatch[0], '');
      }

      if (!fullResponse.trim()) throw new Error('no response received. please try again.');

      loadingEl.innerHTML = renderMarkdown(fullResponse);
      if (modelUsed) {
        const badge = document.createElement('div');
        badge.className = 'chat-model-badge';
        badge.textContent = formatModelName(modelUsed);
        badge.title = 'Answered by ' + modelUsed;
        loadingEl.appendChild(badge);
      }

      chatHistory.push({ role: 'assistant', content: fullResponse, model: modelUsed });
      saveChatHistory();
    } catch (e) {
      let msg = e.message || 'something went wrong. please try again.';
      if (e.name === 'AbortError') {
        msg = 'request timed out. the AI service is slow right now — please try again.';
      }
      loadingEl.textContent = msg;
      loadingEl.classList.remove('loading');
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
