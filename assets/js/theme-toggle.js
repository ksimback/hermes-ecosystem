// Theme toggle — wires the masthead light/dark button. Renders the active
// segment, then flips data-theme (and persists it) on click. Loaded with
// `defer` so #theme-toggle exists by the time this runs.
(function () {
  var t = document.getElementById('theme-toggle');
  if (!t) return;
  function render() {
    var c = document.documentElement.getAttribute('data-theme');
    t.querySelector('.tt-light').classList.toggle('tt-active', c === 'light');
    t.querySelector('.tt-dark').classList.toggle('tt-active', c !== 'light');
  }
  render();
  t.addEventListener('click', function () {
    var c = document.documentElement.getAttribute('data-theme');
    var n = c === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', n);
    try { localStorage.setItem('theme', n); } catch (e) {}
    render();
  });
})();
