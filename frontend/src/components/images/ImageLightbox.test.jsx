import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ImageLightbox from './ImageLightbox';

afterEach(cleanup);

const images = [1, 2, 3].map(id => ({ id, originalName: `image-${id}.png` }));

function renderLightbox({ index = 1, ...props } = {}) {
  const handlers = { onIndexChange: vi.fn(), onClose: vi.fn() };
  render(<ImageLightbox images={images} index={index} getUrl={i => `/img/${i.id}`} {...handlers} {...props} />);
  return handlers;
}

describe('ImageLightbox', () => {
  it('shows the current image and its position', () => {
    renderLightbox();
    expect(screen.getByText('2 / 3')).toBeTruthy();
    expect(screen.getAllByText('image-2.png').length).toBeGreaterThan(0);
    expect(screen.getByAltText('image-2.png').getAttribute('src')).toBe('/img/2');
  });

  it('closes on Esc before any document listener sees it', () => {
    const outer = vi.fn();
    const onDocumentKey = (e) => { if (e.key === 'Escape') outer(); };
    document.addEventListener('keydown', onDocumentKey, true);
    document.addEventListener('keydown', onDocumentKey);
    const { onClose } = renderLightbox();

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
    document.removeEventListener('keydown', onDocumentKey, true);
    document.removeEventListener('keydown', onDocumentKey);
  });

  it('moves between images with the arrow keys and stops at both ends', () => {
    const middle = renderLightbox();
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(middle.onIndexChange).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(middle.onIndexChange).toHaveBeenLastCalledWith(2);
    cleanup();

    const first = renderLightbox({ index: 0 });
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(first.onIndexChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Previous image' }).disabled).toBe(true);
    cleanup();

    const last = renderLightbox({ index: 2 });
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(last.onIndexChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Next image' }).disabled).toBe(true);
  });

  it('closes from the close button and from a click on the backdrop', () => {
    const { onClose } = renderLightbox();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('stops listening once it is closed', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <ImageLightbox images={images} index={0} getUrl={i => `/img/${i.id}`} onIndexChange={() => {}} onClose={onClose} />,
    );
    unmount();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
