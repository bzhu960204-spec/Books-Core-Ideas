import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent } from '@testing-library/react';
import { buildChapterHtml } from './buildChapterHtml';
import runtimeSource from './imageViewer.runtime.js?raw';

// A 1000x500 image in a 400x300 stage: the fit scale is 0.4.
beforeAll(() => {
  Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => 1000 });
  Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', { configurable: true, get: () => 500 });
  const size = (prop, value) => Object.defineProperty(HTMLElement.prototype, prop, {
    configurable: true,
    get() { return this.classList.contains('ci-stage') ? value : 0; },
  });
  size('clientWidth', 400);
  size('clientHeight', 300);
});

// The runtime registers window listeners; remove them so one test cannot hear the next.
const windowListeners = [];
beforeEach(() => {
  const add = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type, fn, opts) => {
    windowListeners.push([type, fn, opts]);
    add(type, fn, opts);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const [type, fn, opts] of windowListeners.splice(0)) window.removeEventListener(type, fn, opts);
  cleanup();
  document.documentElement.className = '';
  document.body.className = '';
  document.body.style.overflow = '';
  document.body.innerHTML = '';
});

const names = ['one.png', 'two.png', 'three.png'];

// Loads an exported document into the page (scripts in it do not run) and runs the viewer.
function load(imageNames = names) {
  const html = buildChapterHtml({
    bookTitle: 'Book', chapterTitle: 'Chapter', content: '<p>Body</p>', updatedAt: '', removeLinks: true, includePrintScript: false,
    images: imageNames.map(name => ({ name, dataUrl: 'data:image/png;base64,AAAA' })),
  });
  const doc = new DOMParser().parseFromString(html, 'text/html');
  document.documentElement.className = doc.documentElement.className;
  document.body.innerHTML = doc.body.innerHTML;
  new Function(runtimeSource)();
}

const fab = () => document.querySelector('.ci-fab');
const panel = () => document.querySelector('.ci-panel');
const lightbox = () => document.querySelector('.ci-lightbox');
const count = () => panel().querySelector('.ci-count').textContent;
const percent = () => panel().querySelector('.ci-zoom-pct').textContent;
const click = (root, label) => fireEvent.click(root.querySelector(`[aria-label="${label}"]`));
const openPanel = () => fireEvent.click(fab());
const loadPanelImage = () => fireEvent.load(panel().querySelector('.ci-img'));

describe('image viewer runtime', () => {
  it('switches the page to its scripted mode', () => {
    load();
    expect(document.documentElement.classList.contains('js')).toBe(true);
    expect(document.documentElement.classList.contains('no-js')).toBe(false);
  });

  it('opens and closes the panel from the floating button', () => {
    load();
    expect(fab().textContent).toContain('3');
    expect(panel().classList.contains('ci-show')).toBe(false);

    openPanel();
    expect(panel().classList.contains('ci-show')).toBe(true);
    expect(document.body.classList.contains('ci-open')).toBe(true);

    click(panel(), 'Close images');
    expect(panel().classList.contains('ci-show')).toBe(false);
    expect(document.body.classList.contains('ci-open')).toBe(false);
  });

  it('steps through the images and disables the buttons at either end', () => {
    load();
    openPanel();
    const prev = panel().querySelector('[aria-label="Previous image"]');
    const next = panel().querySelector('[aria-label="Next image"]');
    expect(count()).toBe('1 / 3');
    expect(prev.disabled).toBe(true);

    fireEvent.click(next);
    expect(count()).toBe('2 / 3');
    fireEvent.click(next);
    expect(count()).toBe('3 / 3');
    expect(next.disabled).toBe(true);

    fireEvent.click(prev);
    expect(count()).toBe('2 / 3');
  });

  it('jumps to an image from its thumbnail', () => {
    load();
    openPanel();
    fireEvent.click(panel().querySelector('[aria-label="Show three.png"]'));
    expect(count()).toBe('3 / 3');
    expect(panel().querySelector('.ci-name').textContent).toBe('three.png');
    expect(panel().querySelector('.ci-thumb.ci-current').getAttribute('aria-label')).toBe('Show three.png');
  });

  it('has no thumbnails for a single image', () => {
    load(['only.png']);
    openPanel();
    expect(panel().querySelector('.ci-thumbs')).toBeNull();
  });

  it('switches images with the arrow keys only while focus is in the panel', () => {
    load();
    openPanel();
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(count()).toBe('1 / 3');

    fireEvent.keyDown(panel().querySelector('.ci-stage'), { key: 'ArrowRight' });
    expect(count()).toBe('2 / 3');
    fireEvent.keyDown(panel().querySelector('.ci-stage'), { key: 'ArrowLeft' });
    expect(count()).toBe('1 / 3');
  });

  it('zooms with the buttons and fits again', () => {
    load();
    openPanel();
    loadPanelImage();
    expect(percent()).toBe('40%');

    click(panel(), 'Zoom in');
    expect(percent()).toBe('48%');
    click(panel(), 'Fit to window');
    expect(percent()).toBe('40%');
    click(panel(), 'Actual size');
    expect(percent()).toBe('100%');
  });

  it('zooms with the wheel without scrolling the page', () => {
    load();
    openPanel();
    loadPanelImage();
    const wheel = new WheelEvent('wheel', { deltaY: -100, cancelable: true, bubbles: true });
    panel().querySelector('.ci-stage').dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(percent()).toBe('48%');
  });

  it('opens the lightbox, shares the image index with the panel, and closes it with Esc', () => {
    load();
    openPanel();
    click(panel(), 'Open full screen');
    expect(lightbox().classList.contains('ci-show')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(lightbox().querySelector('.ci-count').textContent).toBe('2 / 3');
    expect(count()).toBe('2 / 3');

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(lightbox().classList.contains('ci-show')).toBe(false);
    expect(document.body.style.overflow).toBe('');
    // The panel stays open: Esc only closes the lightbox.
    expect(panel().classList.contains('ci-show')).toBe(true);
  });

  it('closes the lightbox on the history pop that the back button causes', async () => {
    load();
    openPanel();
    click(panel(), 'Open full screen');
    expect(history.state).toEqual({ ciLightbox: true });

    history.back();
    await vi.waitFor(() => expect(lightbox().classList.contains('ci-show')).toBe(false));
  });

  it('leaves the keys alone when the lightbox is closed', () => {
    load();
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('shows an image name as text, never as markup', () => {
    load(['<img src=x onerror=alert(1)>.png', 'b.png']);
    openPanel();
    expect(panel().querySelector('.ci-name').textContent).toBe('<img src=x onerror=alert(1)>.png');
    expect(panel().querySelector('.ci-bar img')).toBeNull();
    expect(panel().querySelector('.ci-thumb').getAttribute('aria-label')).toBe('Show <img src=x onerror=alert(1)>.png');
  });

  it('does nothing without a #chapter-images section', () => {
    document.body.innerHTML = '<p>No images here</p>';
    expect(() => new Function(runtimeSource)()).not.toThrow();
    expect(document.querySelector('.ci-fab')).toBeNull();
    expect(document.documentElement.classList.contains('js')).toBe(false);
  });
});
