/* Chapter links seek the on-page player; X resize messages are sender-checked. */
(() => {
  document.querySelectorAll('[data-video-start]').forEach(link => {
    link.addEventListener('click', event => {
      const figure = document.getElementById(link.hash.slice(1));
      const frame = figure?.querySelector('iframe');
      const start = Number(link.dataset.videoStart);
      if (!frame || !Number.isInteger(start) || start < 0 || start > 86400) return;
      const url = new URL(frame.src);
      if (url.origin !== 'https://www.youtube-nocookie.com') return;
      event.preventDefault();
      url.searchParams.set('start', String(start));
      frame.src = url.href;
      figure.scrollIntoView({block: 'center'});
    });
  });
  window.addEventListener('message', event => {
    if (event.origin !== 'https://platform.twitter.com') return;
    const frame = [...document.querySelectorAll('.x-embed iframe')]
      .find(item => item.contentWindow === event.source);
    if (!frame) return;
    let data = event.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { return; }
    }
    const message = data?.['twttr.embed'];
    if (!['twttr.private.resize', 'twttr.private.rendered'].includes(message?.method)) return;
    const height = Number(message.params?.[0]?.height);
    if (Number.isFinite(height) && height >= 150 && height <= 1800) {
      // Leave a small gutter so fractional layout/font rounding does not add a nested scrollbar.
      frame.setAttribute('height', String(Math.ceil(height) + 24));
    }
  });
})();
