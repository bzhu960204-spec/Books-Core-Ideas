import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import ChapterImageViewer from './ChapterImageViewer';
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
  vi.clearAllMocks();
});

const img = (id) => ({ id, originalName: `image-${id}.png` });

const renderViewer = () => render(
  <QueryClientProvider client={createQueryClient()}>
    <ChapterImageViewer chapterId={7} chapterTitle="Ch" onClose={() => {}} />
  </QueryClientProvider>,
);

describe('ChapterImageViewer', () => {
  it('moves back to the new last image after deleting the last one', async () => {
    chapterImageApi.getAll
      .mockResolvedValueOnce([img(1), img(2), img(3)])
      .mockResolvedValueOnce([img(1), img(2)]);
    renderViewer();

    await screen.findByText('image-1.png');
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByText('3 / 3')).toBeTruthy();

    fireEvent.click(screen.getByTitle('Delete image'));

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
    fireEvent.click(screen.getByTitle('Delete image'));

    expect(await screen.findByText('image-2.png')).toBeTruthy();
    expect(screen.getByText('1 / 2')).toBeTruthy();
  });
});
