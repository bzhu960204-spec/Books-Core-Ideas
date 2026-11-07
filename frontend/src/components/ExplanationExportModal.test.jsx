import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExplanationExportModal from './ExplanationExportModal';
import { chapterImageApi } from '../api';
import { getToasts } from './feedback/toast';

vi.mock('../api', () => ({
  chapterImageApi: { getAll: vi.fn(), getBlob: vi.fn() },
}));

const zipFiles = [];
vi.mock('jszip', () => ({
  default: class {
    file(name, content) { zipFiles.push({ name, content }); }
    async generateAsync() { return new Blob(['zip'], { type: 'application/zip' }); }
  },
}));

const withImages = { id: 11, title: 'Has images', seq: 1, partOrder: null, partTitle: null, imageCount: 2 };
const plain = { id: 12, title: 'No images', seq: 2, partOrder: null, partTitle: null, imageCount: 0 };

const png = () => new Blob(['x'], { type: 'image/png' });
const fetchContent = vi.fn(async (id) => ({ content: `<p>Chapter ${id}</p>`, updatedAt: '2026-01-02' }));
const downloads = [];

beforeEach(() => {
  zipFiles.length = 0;
  downloads.length = 0;
  fetchContent.mockClear();
  chapterImageApi.getAll.mockReset().mockResolvedValue([{ id: 1, originalName: 'a.png' }, { id: 2, originalName: 'b.png' }]);
  chapterImageApi.getBlob.mockReset().mockImplementation(async () => png());
  vi.stubGlobal('URL', Object.assign(URL, {
    createObjectURL: vi.fn(blob => { downloads.push(blob); return 'blob:test'; }),
    revokeObjectURL: vi.fn(),
  }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderModal(chapters, onClose = vi.fn()) {
  render(<ExplanationExportModal chapters={chapters} bookTitle="Book" totalChapters={chapters.length} fetchContent={fetchContent} onClose={onClose} />);
  return onClose;
}

const imagesCheckbox = () => screen.queryByRole('checkbox', { name: 'Include images' });
const exportButton = () => screen.getByRole('button', { name: /^Export \(/ });

describe('ExplanationExportModal images', () => {
  it('offers "Include images" only for HTML exports of chapters that have images', () => {
    renderModal([plain]);
    expect(imagesCheckbox()).toBeNull();
    cleanup();

    renderModal([withImages, plain]);
    expect(imagesCheckbox().checked).toBe(true);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'pdf' } });
    expect(imagesCheckbox()).toBeNull();
  });

  it('hides the option when no selected chapter has images', () => {
    renderModal([withImages, plain]);
    // checkboxes: select all, then one per chapter
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    expect(imagesCheckbox()).toBeNull();
  });

  it('embeds the images of the chapters that have them', async () => {
    const onClose = renderModal([withImages, plain]);
    fireEvent.click(exportButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(chapterImageApi.getAll).toHaveBeenCalledTimes(1);
    expect(chapterImageApi.getAll).toHaveBeenCalledWith(11);
    expect(chapterImageApi.getBlob).toHaveBeenCalledTimes(2);
    const [first, second] = zipFiles.map(f => f.content);
    expect(first).toContain('id="chapter-images"');
    expect(second).not.toContain('chapter-images');
    expect(getToasts()).toEqual([]);
  });

  it('does not request images once "Include images" is unchecked', async () => {
    const onClose = renderModal([withImages, plain]);
    fireEvent.click(imagesCheckbox());
    fireEvent.click(exportButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(chapterImageApi.getAll).not.toHaveBeenCalled();
    expect(zipFiles.every(f => !f.content.includes('chapter-images'))).toBe(true);
  });

  it('does not request images for a PDF export', async () => {
    const popup = { document: { write: vi.fn(), close: vi.fn() } };
    vi.spyOn(window, 'open').mockReturnValue(popup);
    const onClose = renderModal([withImages]);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'pdf' } });
    fireEvent.click(exportButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(chapterImageApi.getAll).not.toHaveBeenCalled();
    expect(popup.document.write).toHaveBeenCalledTimes(1);
  });

  it('still exports when an image cannot be downloaded, and says so', async () => {
    chapterImageApi.getBlob.mockImplementation(async (_chapterId, imageId) => {
      if (imageId === 2) throw new Error('gone');
      return png();
    });
    const onClose = renderModal([withImages]);
    fireEvent.click(exportButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(downloads).toHaveLength(1);
    const html = await downloads[0].text();
    expect(html.match(/class="ci-fig"/g)).toHaveLength(1);
    expect(getToasts().map(t => t.message)).toContain("1 image(s) couldn't be included in the export.");
  });

  it('shows which chapter is being exported', async () => {
    let release;
    fetchContent.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    renderModal([plain, { ...plain, id: 13, seq: 3 }]);
    fireEvent.click(exportButton());

    expect(await screen.findByRole('button', { name: 'Exporting 1/2…' })).toBeTruthy();
    release({ content: '<p>x</p>', updatedAt: '' });
    await waitFor(() => expect(zipFiles).toHaveLength(2));
  });
});
