// With code splitting (FE-04), a page that stays open across a rebuild (e.g. a new
// prod jar) asks for hashed chunks that no longer exist. Vite reports that as
// 'vite:preloadError': reload once to get the new index.html and its chunks. If
// the reload did not help (a chunk is really missing), the error is let through
// to the page's ErrorBoundary (FE-05).
const KEY = 'chunkReloadAt';
const RETRY_AFTER_MS = 10_000;

let reloading = false;

/** True once a reload for a missing chunk has started: the error screen would only flash. */
export const isReloadingForChunk = () => reloading;

// Browsers word a failed dynamic import differently; Vite adds its own for CSS.
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

export const isChunkLoadError = (error) => CHUNK_ERROR.test(error?.message ?? '');

export function installChunkReload(win = window) {
  win.addEventListener('vite:preloadError', (event) => {
    const last = Number(win.sessionStorage.getItem(KEY)) || 0;
    if (Date.now() - last < RETRY_AFTER_MS) return;
    win.sessionStorage.setItem(KEY, String(Date.now()));
    event.preventDefault();
    reloading = true;
    win.location.reload();
  });
}
