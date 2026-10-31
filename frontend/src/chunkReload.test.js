import { afterEach, describe, expect, it, vi } from 'vitest';
import { installChunkReload } from './chunkReload';

afterEach(() => vi.useRealTimers());

function fakeWindow() {
  const listeners = {};
  const store = new Map();
  return {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    sessionStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    location: { reload: vi.fn() },
    fire: (type) => { const event = { preventDefault: vi.fn() }; listeners[type](event); return event; },
  };
}

describe('installChunkReload', () => {
  it('reloads once when a chunk fails to load, then lets a repeated failure through', () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const win = fakeWindow();
    installChunkReload(win);

    const first = win.fire('vite:preloadError');
    expect(first.preventDefault).toHaveBeenCalled();
    expect(win.location.reload).toHaveBeenCalledTimes(1);

    vi.setSystemTime(1_005_000);
    const again = win.fire('vite:preloadError');
    expect(again.preventDefault).not.toHaveBeenCalled();
    expect(win.location.reload).toHaveBeenCalledTimes(1);

    vi.setSystemTime(1_020_000);
    win.fire('vite:preloadError');
    expect(win.location.reload).toHaveBeenCalledTimes(2);
  });
});
