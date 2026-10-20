// /ecosystem/ catalog behavior — carved out of homepage.js when the catalog
// moved to its own generated page. Covers: repo-row tooltips, live star
// counts + weekly deltas + trending badges from /api/stars(-history), and the
// progressive-enhancement search/sort controls. Masthead values are handled
// by masthead-fetch.js; the theme toggle by theme-toggle.js.
(function () {
  // ── Tooltip ──
  const tooltip = document.getElementById('tooltip');
  const ttName = document.getElementById('tt-name');
  const ttDesc = document.getElementById('tt-desc');

  function positionTooltip(e) {
    const pad = 12;
    let x = e.clientX + pad, y = e.clientY + pad;
    const w = 340, h = tooltip.getBoundingClientRect().height || 80;
    if (x + w > window.innerWidth) x = e.clientX - w - pad;
    if (y + h > window.innerHeight) y = e.clientY - h - pad;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  }

  function initTooltips() {
    if (!tooltip) return;
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
  initTooltips();

  // ── Add data-repo attributes to repo rows ──
  document.querySelectorAll('.repo-row[data-github]').forEach(item => {
    const match = item.getAttribute('data-github').match(/github\.com\/([^/]+\/[^/]+)/);
    if (match) item.setAttribute('data-repo', match[1]);
  });

  function formatStars(n) {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

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
        // showing weekly growth — sparse history mislabels "since first
        // snapshot" as "weekly" and inflates trending badges.
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
    } catch (e) {
      console.log('Stars API unavailable, using static counts', e);
    }
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
  initCatalogControls();
})();
