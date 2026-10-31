// App-wide notifications (FE-05). A small store outside React, so anything can
// report: page handlers, the editor's paste handler, the global
// unhandledrejection listener. <Toaster> (rendered once in App) shows them.
const DURATION_MS = { error: 8000, info: 4000 };
const MAX_VISIBLE = 4;

let toasts = [];
let nextId = 1;
const timers = new Map();
const listeners = new Set();

const emit = () => listeners.forEach(listener => listener());

export function subscribeToasts(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getToasts = () => toasts;

/** Shows a message ('error' | 'info'); the same message again restarts its timer instead of stacking. */
export function showToast(message, type = 'error') {
  let toast = toasts.find(t => t.message === message && t.type === type);
  if (!toast) {
    toast = { id: nextId++, type, message };
    const all = [...toasts, toast];
    all.slice(0, -MAX_VISIBLE).forEach(t => clearTimeout(timers.get(t.id)));
    toasts = all.slice(-MAX_VISIBLE);
    emit();
  }
  clearTimeout(timers.get(toast.id));
  timers.set(toast.id, setTimeout(() => dismissToast(toast.id), DURATION_MS[type] ?? DURATION_MS.info));
  return toast.id;
}

export function dismissToast(id) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  if (!toasts.some(t => t.id === id)) return;
  toasts = toasts.filter(t => t.id !== id);
  emit();
}

export function clearToasts() {
  timers.forEach(timer => clearTimeout(timer));
  timers.clear();
  toasts = [];
  emit();
}

export function describeError(err) {
  return err?.message || (err ? String(err) : 'Unknown error');
}

/** A failed action: "<action> — <reason>", e.g. "Could not delete the chapter — Chapter not found: 5". */
export function reportError(action, err) {
  console.error(action, err);
  showToast(`${action} — ${describeError(err)}`, 'error');
}

/** Runs a write; on failure reports it and resolves false, so the caller keeps its form or dialog open. */
export async function attempt(action, write) {
  try {
    await write();
    return true;
  } catch (err) {
    reportError(action, err);
    return false;
  }
}

/** Safety net for a failed promise nobody handled (e.g. an event handler without try/catch). */
export function reportUnhandledRejections(win = window) {
  win.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.name === 'AbortError') return;
    showToast(`Something went wrong — ${describeError(event.reason)}`, 'error');
  });
}
