import { describe, expect, it, vi } from 'vitest';
import { loadExportImages } from './exportImages';

const png = () => new Blob(['x'], { type: 'image/png' });
const list = [
  { id: 1, originalName: 'a.png' },
  { id: 2, originalName: '' },
  { id: 3, originalName: 'c.png' },
];

describe('loadExportImages', () => {
  it('returns the images in the order the backend lists them, as data URLs', async () => {
    const api = {
      getAll: vi.fn(async () => list),
      // The first image answers last: the order must not depend on download order.
      getBlob: vi.fn(async (_chapterId, imageId) => {
        if (imageId === 1) await new Promise(resolve => setTimeout(resolve, 10));
        return png();
      }),
    };
    const { images, failed } = await loadExportImages(7, 3, api);

    expect(failed).toBe(0);
    expect(images.map(i => i.name)).toEqual(['a.png', 'Image 2', 'c.png']);
    expect(images.every(i => i.dataUrl.startsWith('data:image/png;base64,'))).toBe(true);
    expect(api.getAll).toHaveBeenCalledWith(7);
    expect(api.getBlob).toHaveBeenCalledWith(7, 2);
  });

  it('skips an image that fails to download and counts it', async () => {
    const api = {
      getAll: async () => list,
      getBlob: async (_chapterId, imageId) => {
        if (imageId === 2) throw new Error('boom');
        return png();
      },
    };
    const { images, failed } = await loadExportImages(7, 3, api);

    expect(images.map(i => i.name)).toEqual(['a.png', 'c.png']);
    expect(failed).toBe(1);
  });

  it.each(['image/svg+xml', 'text/html', ''])('skips an image of type "%s"', async (type) => {
    const api = {
      getAll: async () => [list[0]],
      getBlob: async () => new Blob(['<svg/>'], { type }),
    };
    expect(await loadExportImages(7, 1, api)).toEqual({ images: [], failed: 1 });
  });

  it('reports every image as failed when the list cannot be loaded', async () => {
    const api = { getAll: async () => { throw new Error('down'); }, getBlob: vi.fn() };
    expect(await loadExportImages(7, 5, api)).toEqual({ images: [], failed: 5 });
    expect(api.getBlob).not.toHaveBeenCalled();
  });

  it('downloads at most three images at a time', async () => {
    let active = 0;
    let peak = 0;
    const many = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, originalName: `${i + 1}.png` }));
    const api = {
      getAll: async () => many,
      getBlob: async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise(resolve => setTimeout(resolve, 5));
        active--;
        return png();
      },
    };
    const { images } = await loadExportImages(7, 8, api);

    expect(images).toHaveLength(8);
    expect(peak).toBe(3);
  });
});
