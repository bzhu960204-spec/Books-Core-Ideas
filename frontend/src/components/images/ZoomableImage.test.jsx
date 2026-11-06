import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import ZoomableImage from './ZoomableImage';

// A 1000x500 image in a 400x300 container: the fit scale is 0.4.
beforeAll(() => {
  Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => 1000 });
  Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', { configurable: true, get: () => 500 });
  const size = (prop, value) => Object.defineProperty(HTMLElement.prototype, prop, {
    configurable: true,
    get() { return this.classList.contains('zoomable-image-viewport') ? value : 0; },
  });
  size('clientWidth', 400);
  size('clientHeight', 300);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderLoaded(props) {
  const utils = render(<ZoomableImage src="/a.png" alt="A" {...props} />);
  fireEvent.load(screen.getByAltText('A'));
  return { ...utils, viewport: document.querySelector('.zoomable-image-viewport') };
}

const percent = () => document.querySelector('.zoomable-image-percent').textContent;

describe('ZoomableImage', () => {
  it('starts fitted to the container', () => {
    renderLoaded();
    expect(percent()).toBe('40%');
  });

  it('zooms with the buttons and disables them at the limits', () => {
    renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(percent()).toBe('48%');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(percent()).toBe('40%');

    const zoomIn = screen.getByRole('button', { name: 'Zoom in' });
    for (let i = 0; i < 50 && !zoomIn.disabled; i += 1) fireEvent.click(zoomIn);
    expect(zoomIn.disabled).toBe(true);
    expect(percent()).toBe('800%');

    const zoomOut = screen.getByRole('button', { name: 'Zoom out' });
    for (let i = 0; i < 80 && !zoomOut.disabled; i += 1) fireEvent.click(zoomOut);
    expect(zoomOut.disabled).toBe(true);
    expect(percent()).toBe('10%');
  });

  it('jumps to 100% and back to fit', () => {
    renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: '1:1' }));
    expect(percent()).toBe('100%');
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    expect(percent()).toBe('40%');
  });

  it('follows the keyboard only while it has focus', () => {
    const { viewport } = renderLoaded();

    fireEvent.keyDown(document.body, { key: '1' });
    expect(percent()).toBe('40%');

    fireEvent.keyDown(viewport, { key: '1' });
    expect(percent()).toBe('100%');
    fireEvent.keyDown(viewport, { key: '-' });
    expect(percent()).toBe('83%');
    fireEvent.keyDown(viewport, { key: '+' });
    expect(percent()).toBe('100%');
    fireEvent.keyDown(viewport, { key: '0' });
    expect(percent()).toBe('40%');
  });

  it('toggles between fit and 100% on double click', () => {
    const { viewport } = renderLoaded();
    fireEvent.doubleClick(viewport, { clientX: 100, clientY: 100 });
    expect(percent()).toBe('100%');
    fireEvent.doubleClick(viewport, { clientX: 100, clientY: 100 });
    expect(percent()).toBe('40%');
  });

  it('zooms with the wheel and keeps the page from scrolling', () => {
    const { viewport } = renderLoaded();
    const wheel = new WheelEvent('wheel', { deltaY: -100, cancelable: true, bubbles: true });
    act(() => { viewport.dispatchEvent(wheel); });
    expect(wheel.defaultPrevented).toBe(true);
    expect(percent()).toBe('48%');
  });

  it('shows the expand button only when asked to', () => {
    const onExpand = vi.fn();
    const { unmount } = renderLoaded({ onExpand });
    fireEvent.click(screen.getByRole('button', { name: 'Open full screen' }));
    expect(onExpand).toHaveBeenCalled();
    unmount();

    renderLoaded();
    expect(screen.queryByRole('button', { name: 'Open full screen' })).toBeNull();
  });
});
