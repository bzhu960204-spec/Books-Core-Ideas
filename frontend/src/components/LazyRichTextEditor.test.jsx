import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import LazyRichTextEditor from './LazyRichTextEditor';

beforeAll(() => {
  const rect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {} };
  Range.prototype.getBoundingClientRect = () => rect;
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] });
  Element.prototype.scrollIntoView = () => {};
  document.elementFromPoint = () => null;
});

afterEach(cleanup);

describe('LazyRichTextEditor (FE-04)', () => {
  // Regression: React commits a lazily loaded component some time after rendering
  // it, and TipTap destroys an editor created during render that is not mounted
  // within 1 ms; the editor's effects then used the destroyed instance and threw.
  it('mounts a working editor once the editor code has loaded', async () => {
    const errors = [];
    const onError = (e) => { errors.push(e.error?.message ?? String(e.message)); e.preventDefault(); };
    window.addEventListener('error', onError);
    const consoleError = vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args.join(' ')));
    try {
      render(
        <StrictMode>
          <LazyRichTextEditor value="<p>Hello</p>" onChange={() => {}} />
        </StrictMode>,
      );
      expect(screen.getByText('Loading editor')).toBeTruthy();
      const pm = await screen.findByRole('textbox', {}, { timeout: 10_000 });
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(pm.textContent).toBe('Hello');
      expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeTruthy();
      expect(errors).toEqual([]);
    } finally {
      window.removeEventListener('error', onError);
      consoleError.mockRestore();
    }
  }, 20_000);
});
