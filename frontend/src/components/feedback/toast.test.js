import { afterEach, describe, expect, it, vi } from 'vitest';
import { attempt, clearToasts, dismissToast, getToasts, reportError, reportUnhandledRejections, showToast } from './toast';

afterEach(() => {
  clearToasts();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const messages = () => getToasts().map(t => t.message);

describe('toast store', () => {
  it('shows a message until it times out (errors stay longer than notices)', () => {
    vi.useFakeTimers();
    showToast('Saved elsewhere', 'info');
    showToast('Could not save');
    expect(getToasts().map(t => [t.type, t.message])).toEqual([['info', 'Saved elsewhere'], ['error', 'Could not save']]);

    vi.advanceTimersByTime(4000);
    expect(messages()).toEqual(['Could not save']);
    vi.advanceTimersByTime(4000);
    expect(messages()).toEqual([]);
  });

  it('shows a repeated message once and restarts its timer', () => {
    vi.useFakeTimers();
    showToast('Cannot reach the server');
    vi.advanceTimersByTime(7000);
    showToast('Cannot reach the server');
    vi.advanceTimersByTime(7000);
    expect(messages()).toEqual(['Cannot reach the server']);
    vi.advanceTimersByTime(1000);
    expect(messages()).toEqual([]);
  });

  it('keeps the four newest and can be dismissed', () => {
    ['a', 'b', 'c', 'd', 'e'].forEach(m => showToast(m));
    expect(messages()).toEqual(['b', 'c', 'd', 'e']);
    dismissToast(getToasts()[0].id);
    expect(messages()).toEqual(['c', 'd', 'e']);
  });
});

describe('reporting failures', () => {
  it('names the action and the reason', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reportError('Could not delete the chapter', new Error('Chapter not found: 5'));
    expect(messages()).toEqual(['Could not delete the chapter — Chapter not found: 5']);
  });

  it('attempt() resolves true on success, and false after reporting a failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await attempt('Could not save', () => Promise.resolve())).toBe(true);
    expect(messages()).toEqual([]);
    expect(await attempt('Could not save', () => Promise.reject(new Error('down')))).toBe(false);
    expect(messages()).toEqual(['Could not save — down']);
  });

  it('reports promises nobody handled, except cancelled requests', () => {
    const target = new EventTarget();
    reportUnhandledRejections(target);
    const fire = (reason) => {
      const event = new Event('unhandledrejection');
      event.reason = reason;
      target.dispatchEvent(event);
    };
    fire(new DOMException('aborted', 'AbortError'));
    expect(messages()).toEqual([]);
    fire(new Error('Request failed: 500'));
    expect(messages()).toEqual(['Something went wrong — Request failed: 500']);
  });
});
