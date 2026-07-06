// Theme init — runs synchronously before any content renders to prevent a
// flash of the wrong theme. Reads the stored preference (falling back to the
// OS color-scheme) and stamps data-theme on <html> before first paint.
// Loaded with a plain (non-defer) <script src> in <head> so it executes in place.
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var osLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    var theme = stored || (osLight ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
