// With code splitting (FE-04), a page that stays open across a rebuild (e.g. a new
// prod jar) asks for hashed chunks that no longer exist. Vite reports that as
// 'vite:preloadError': reload once to get the new index.html and its chunks. If
// the reload did not help (a chunk is really missing), the error is let through.
const KEY = 'chunkReloadAt';
const RETRY_AFTER_MS = 10_000;

export function installChunkReload(win = window) {
  win.addEventListener('vite:preloadError', (event) => {
    const last = Number(win.sessionStorage.getItem(KEY)) || 0;
    if (Date.now() - last < RETRY_AFTER_MS) return;
    win.sessionStorage.setItem(KEY, String(Date.now()));
    event.preventDefault();
    win.location.reload();
  });
}
