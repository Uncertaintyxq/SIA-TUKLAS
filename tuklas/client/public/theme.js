// Apply the saved theme and look before first paint, so there's no flash of the wrong one.
// A plain script loaded by index.html ahead of the app; keep it tiny and dependency-free.
try {
  var p = JSON.parse(localStorage.getItem('tuklas.prefs.v1') || '{}');
  var dark = p.theme === 'dark' || ((!p.theme || p.theme === 'system') && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.appearance = p.appearance === 'classic' ? 'classic' : 'modern';
} catch {
  // Storage blocked or unreadable: the stylesheet's defaults apply
}
