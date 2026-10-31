import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ChapterImageViewer from './ChapterImageViewer';
import { chapterImageApi } from '../api';

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

describe('ChapterImageViewer', () => {
  it('moves back to the new last image after deleting the last one', async () => {
    chapterImageApi.getAll
      .mockResolvedValueOnce([img(1), img(2), img(3)])
      .mockResolvedValueOnce([img(1), img(2)]);
    render(<ChapterImageViewer chapterId={7} chapterTitle="Ch" onClose={() => {}} />);

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
    render(<ChapterImageViewer chapterId={7} chapterTitle="Ch" onClose={() => {}} />);

    await screen.findByText('image-1.png');
    fireEvent.click(screen.getByTitle('Delete image'));

    expect(await screen.findByText('image-2.png')).toBeTruthy();
    expect(screen.getByText('1 / 2')).toBeTruthy();
  });
});
