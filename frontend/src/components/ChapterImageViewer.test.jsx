import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import ChapterImageViewer from './ChapterImageViewer';
import Toaster from './feedback/Toaster';
import { clearToasts } from './feedback/toast';
import { chapterImageApi } from '../api';
import { createQueryClient } from '../queries';

vi.mock('../api', () => ({
  chapterImageApi: {
    getAll: vi.fn(),
    delete: vi.fn(() => Promise.resolve()),
    upload: vi.fn(),
    getUrl: (chapterId, imageId) => `/img/${chapterId}/${imageId}`,
  },
}));

afterEach(() => {
  cleanup();
  clearToasts();
  vi.clearAllMocks();
});

const img = (id) => ({ id, originalName: `image-${id}.png` });

const renderViewer = () => render(
  <QueryClientProvider client={createQueryClient()}>
    <ChapterImageViewer chapterId={7} chapterTitle="Ch" onClose={() => {}} />
    <Toaster />
  </QueryClientProvider>,
);

const deleteCurrent = () => {
  fireEvent.click(screen.getByTitle('Delete image'));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
};

describe('ChapterImageViewer', () => {
  it('lets the image be zoomed and opened full screen', async () => {
    chapterImageApi.getAll.mockResolvedValue([img(1), img(2)]);
    renderViewer();

    await screen.findByText('image-1.png');
    expect(screen.getByRole('toolbar', { name: 'Zoom' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open full screen' }));
    expect(screen.getByRole('dialog', { name: 'Image viewer' })).toBeTruthy();

    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(screen.getAllByText('image-2.png').length).toBeGreaterThan(0);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Image viewer' })).toBeNull();
  });

  it('moves back to the new last image after deleting the last one', async () => {
    chapterImageApi.getAll
      .mockResolvedValueOnce([img(1), img(2), img(3)])
      .mockResolvedValueOnce([img(1), img(2)]);
    renderViewer();

    await screen.findByText('image-1.png');
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByText('3 / 3')).toBeTruthy();

    deleteCurrent();

    expect(await screen.findByText('image-2.png')).toBeTruthy();
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(chapterImageApi.delete).toHaveBeenCalledWith(7, 3);
  });

  it('keeps the current position when a deleted image was not the last one', async () => {
    chapterImageApi.getAll
      .mockResolvedValueOnce([img(1), img(2), img(3)])
      .mockResolvedValueOnce([img(2), img(3)]);
    renderViewer();

    await screen.findByText('image-1.png');
    deleteCurrent();

    expect(await screen.findByText('image-2.png')).toBeTruthy();
    expect(screen.getByText('1 / 2')).toBeTruthy();
  });

  // FE-05: deleting asks first, and a failure is reported.
  it('asks before deleting an image', async () => {
    chapterImageApi.getAll.mockResolvedValue([img(1)]);
    renderViewer();

    await screen.findByText('image-1.png');
    fireEvent.click(screen.getByTitle('Delete image'));
    expect(screen.getByText('Delete the image "image-1.png"? This cannot be undone.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText(/Delete the image/)).toBeNull();
    expect(chapterImageApi.delete).not.toHaveBeenCalled();
  });

  it('reports a failed delete and keeps the confirmation open', async () => {
    chapterImageApi.getAll.mockResolvedValue([img(1)]);
    chapterImageApi.delete.mockRejectedValueOnce(new Error('Image not found: 1'));
    renderViewer();

    await screen.findByText('image-1.png');
    deleteCurrent();

    expect((await screen.findByRole('alert')).textContent).toContain('Could not delete the image — Image not found: 1');
    expect(screen.getByText(/Delete the image/)).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' }).disabled).toBe(false));
  });

  // Regression (BUG-19): a failed load showed "No images yet".
  it('says the images could not be loaded instead of "No images yet"', async () => {
    chapterImageApi.getAll.mockRejectedValueOnce(new Error('down')).mockRejectedValueOnce(new Error('down'));
    renderViewer();

    expect((await screen.findByRole('alert', {}, { timeout: 5000 })).textContent).toContain('Could not load the images — down');
    expect(screen.queryByText('No images yet')).toBeNull();
  });

  it('reports a failed upload', async () => {
    chapterImageApi.getAll.mockResolvedValue([]);
    chapterImageApi.upload.mockRejectedValueOnce(new Error('Maximum upload size exceeded'));
    renderViewer();

    fireEvent.click(await screen.findByRole('button', { name: 'Upload Images' }));
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(['x'], 'a.png')] } });

    expect((await screen.findByRole('alert')).textContent).toContain('Could not upload the images — Maximum upload size exceeded');
  });

  // Regression (BUG-10): files the server did not save were dropped without a word.
  it('names the skipped files and shows the saved ones', async () => {
    chapterImageApi.getAll.mockResolvedValueOnce([]).mockResolvedValue([img(1)]);
    chapterImageApi.upload.mockResolvedValueOnce({
      images: [img(1)],
      skipped: [
        { name: 'notes.txt', reason: 'not a PNG, JPEG, GIF or WebP image' },
        { name: 'empty.png', reason: 'empty file' },
      ],
    });
    renderViewer();

    fireEvent.click(await screen.findByRole('button', { name: 'Upload Images' }));
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(['x'], 'a.png')] } });

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Skipped 2 files — notes.txt (not a PNG, JPEG, GIF or WebP image); empty.png (empty file)');
    expect(await screen.findByText('image-1.png')).toBeTruthy();
  });

  it('stays in upload mode when no file was saved', async () => {
    chapterImageApi.getAll.mockResolvedValue([]);
    chapterImageApi.upload.mockResolvedValueOnce({
      images: [],
      skipped: [{ name: 'logo.svg', reason: 'not a PNG, JPEG, GIF or WebP image' }],
    });
    renderViewer();

    fireEvent.click(await screen.findByRole('button', { name: 'Upload Images' }));
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(['x'], 'logo.svg')] } });

    expect((await screen.findByRole('alert')).textContent).toContain(
      'No image was uploaded — logo.svg (not a PNG, JPEG, GIF or WebP image)');
    expect(screen.getByText(/Drag & drop images here/)).toBeTruthy();
  });
});
