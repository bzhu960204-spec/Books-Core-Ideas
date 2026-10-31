import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import BookMigrationModal from './BookMigrationModal';
import { migrationApi } from '../api';

vi.mock('../api', () => ({
  migrationApi: { preview: vi.fn(), import: vi.fn(), exportBooks: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('BookMigrationModal', () => {
  it('says the archive carries reviews, bookmarks, saved passages and collections', () => {
    render(<BookMigrationModal books={[{ id: 1, title: 'B' }]} onClose={() => {}} />);
    expect(screen.getByText(/reviews, reading bookmarks, saved passages/)).toBeTruthy();
  });

  it('shows what each archived book carries in the import preview', async () => {
    migrationApi.preview.mockResolvedValue({
      formatVersion: 2, totalBooks: 1, conflicts: 0,
      books: [{ title: 'Atomic Habits', author: 'James Clear', chapterCount: 20, imageCount: 0,
        hasExplanations: true, conflict: false, reviewCount: 1, bookmarkCount: 3, markCount: 0, collectionCount: 2 }],
    });
    render(<BookMigrationModal books={[]} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Import/ }));

    const file = new File(['zip'], 'books.zip', { type: 'application/zip' });
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } });

    expect(await screen.findByText('20 ch · 0 img · 详解 · 1 review · 3 bookmarks · 2 collections')).toBeTruthy();
    expect(migrationApi.preview).toHaveBeenCalledWith(file);
  });
});
