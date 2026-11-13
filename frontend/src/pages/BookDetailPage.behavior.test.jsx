// Characterization tests for FE-01: what the book page does for the user, written
// against the single-file page and kept passing while it is split into parts.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BookDetailPage from './BookDetailPage';
import { createQueryClient } from '../queries';
import { bookDetail, installFakeBackend, partsBookDetail } from '../test/fakeBackend';

vi.mock('../components/RichTextEditor', () => ({
  default: ({ value, onChange }) => (
    <textarea data-testid="editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}));

beforeAll(() => {
  // Layout APIs jsdom lacks; the explanation reader measures ranges when jumping to a passage.
  const rect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {} };
  Range.prototype.getBoundingClientRect = () => rect;
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] });
});

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderBook(detail, state, delay) {
  const backend = installFakeBackend({ details: [detail], delay });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[{ pathname: `/book/${detail.book.id}`, state }]}>
        <Routes>
          <Route path="/book/:id" element={<BookDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return backend;
}

const lastWrite = (writes) => writes[writes.length - 1];
const dialog = (title) => screen.getByRole('heading', { name: title }).closest('[role="dialog"]');

describe('book header', () => {
  it('changes the reading status at once, then shows what the server stored', async () => {
    let answer;
    const held = new Promise(resolve => { answer = resolve; });
    const { writes } = renderBook(bookDetail(1, 'Book One', 2), undefined, (path) => (path === '/api/books/1' ? held : null));
    expect(await screen.findByRole('heading', { name: 'Book One' })).toBeTruthy();
    expect(screen.getByText('by Author')).toBeTruthy();

    fireEvent.click(screen.getByTitle('Change reading status'));
    fireEvent.click(screen.getByRole('button', { name: '📖 Reading' }));

    // Shown before the server has answered.
    await waitFor(() => expect(screen.getByTitle('Change reading status').textContent).toContain('📖 Reading'));
    answer();
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ method: 'PUT', path: '/api/books/1', body: { title: 'Book One', readingStatus: 'READING' } });
    // The fake server keeps no status, so the refresh puts "not set" back.
    await waitFor(() => expect(screen.getByTitle('Change reading status').textContent).toContain('Set status'));
  });

  it('links back to the library, or to the collection it was opened from', async () => {
    renderBook(bookDetail(1, 'Book One'));
    expect((await screen.findByText('← Back to Library')).getAttribute('href')).toBe('/');
    cleanup();

    renderBook(bookDetail(1, 'Book One'), { from: 'collections', collectionId: 5 });
    expect((await screen.findByText('← Back to Collection')).getAttribute('href')).toBe('/collections');
  });

  it('downloads the book as JSON', async () => {
    const { requests } = renderBook(bookDetail(1, 'Book One'));
    URL.createObjectURL = vi.fn(() => 'blob:book');
    URL.revokeObjectURL = vi.fn();
    const downloads = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() { downloads.push(this.download); });

    fireEvent.click(await screen.findByRole('button', { name: '📥 Export JSON' }));

    await waitFor(() => expect(downloads).toEqual(['Book One.json']));
    expect(requests).toContain('GET /api/books/1/export');
  });
});

describe('chapters and ideas', () => {
  it('adds, edits and deletes chapters', async () => {
    const { writes } = renderBook(bookDetail(1, 'Book One', 2));

    fireEvent.click(await screen.findByRole('button', { name: '+ Add Chapter' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Chapter 1: Introduction'), { target: { value: 'New chapter' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Chapter' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      method: 'POST', path: '/api/books/1/chapters', body: { title: 'New chapter', orderIndex: 1, summary: '', partId: null },
    });
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add Chapter' })).toBeNull());

    fireEvent.click(screen.getAllByTitle('Edit chapter')[1]);
    expect(screen.getByDisplayValue('Book One chapter 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toEqual({
      method: 'PUT', path: '/api/books/1/chapters/102', body: { title: 'Book One chapter 2', orderIndex: 2, summary: '', partId: null },
    });

    fireEvent.click(screen.getAllByTitle('Delete chapter')[0]);
    expect(screen.getByText('Delete chapter "Book One chapter 1"? This cannot be undone.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(writes).toHaveLength(3));
    expect(writes[2]).toEqual({ method: 'DELETE', path: '/api/books/1/chapters/101', body: undefined });
    await waitFor(() => expect(screen.queryByText(/This cannot be undone/)).toBeNull());
  });

  it('expands one chapter at a time', async () => {
    renderBook(bookDetail(1, 'Book One', 2));

    fireEvent.click(await screen.findByText('Book One chapter 1'));
    expect(screen.getByText('Idea of 101')).toBeTruthy();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Book One chapter 2'));
    expect(screen.queryByText('Idea of 101')).toBeNull();
    expect(screen.getByText('Idea of 102')).toBeTruthy();

    fireEvent.click(screen.getByText('Book One chapter 2'));
    expect(screen.queryByText('Idea of 102')).toBeNull();
  });

  it('stars, adds, edits and deletes ideas', async () => {
    const { writes } = renderBook(bookDetail(1, 'Book One', 2));
    fireEvent.click(await screen.findByText('Book One chapter 1'));

    fireEvent.click(screen.getByTitle('Add to Idea Bank'));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      method: 'PUT', path: '/api/chapters/101/ideas/1010', body: { content: 'Idea of 101', highlighted: true },
    });

    fireEvent.click(screen.getByRole('button', { name: '+ Add Idea' }));
    fireEvent.change(screen.getByPlaceholderText('Describe the key idea or concept'), { target: { value: 'Fresh idea' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Idea' }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toMatchObject({ method: 'POST', path: '/api/chapters/101/ideas', body: { content: 'Fresh idea' } });
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add Key Idea' })).toBeNull());

    fireEvent.click(screen.getByTitle('Edit idea'));
    expect(screen.getByRole('heading', { name: 'Edit Key Idea' })).toBeTruthy();
    expect(screen.getByDisplayValue('Idea of 101')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(writes).toHaveLength(3));
    expect(writes[2]).toMatchObject({ method: 'PUT', path: '/api/chapters/101/ideas/1010', body: { content: 'Idea of 101' } });
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit Key Idea' })).toBeNull());

    fireEvent.click(screen.getByTitle('Delete idea'));
    expect(screen.getByText('Delete idea "Idea of 101"? This cannot be undone.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(writes).toHaveLength(4));
    expect(writes[3]).toEqual({ method: 'DELETE', path: '/api/chapters/101/ideas/1010', body: undefined });
  });

  it('offers the first idea of an empty chapter', async () => {
    const detail = bookDetail(1, 'Book One', 1);
    detail.chapters[0].keyIdeas = [];
    const { writes } = renderBook(detail);

    fireEvent.click(await screen.findByText('Book One chapter 1'));
    expect(screen.getByText('No key ideas yet for this chapter.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+ Add First Idea' }));
    fireEvent.change(screen.getByPlaceholderText('Describe the key idea or concept'), { target: { value: 'First' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Idea' }));
    await waitFor(() => expect(lastWrite(writes)).toMatchObject({ method: 'POST', path: '/api/chapters/101/ideas' }));
  });

  it('reads, stars, edits and deletes excerpts', async () => {
    const { writes } = renderBook(bookDetail(1, 'Book One', 2));

    fireEvent.click((await screen.findAllByTitle('Read excerpts'))[0]);
    expect(screen.getByText('1 / 2')).toBeTruthy();
    expect(screen.getByText('Excerpt 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(screen.getByText('2 / 2')).toBeTruthy();

    fireEvent.click(screen.getByTitle('Add to Excerpt Bank'));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      method: 'PUT', path: '/api/chapters/101/excerpts/1012', body: { content: 'Excerpt 2', highlighted: true },
    });

    fireEvent.click(screen.getByTitle('Actions'));
    fireEvent.click(screen.getByRole('button', { name: '✏️ Edit' }));
    expect(screen.getByRole('heading', { name: 'Edit Excerpt' })).toBeTruthy();
    expect(screen.queryByText('2 / 2')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toMatchObject({ method: 'PUT', path: '/api/chapters/101/excerpts/1012', body: { content: 'Excerpt 2' } });
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit Excerpt' })).toBeNull());

    fireEvent.click(screen.getAllByTitle('Read excerpts')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }));
    fireEvent.click(screen.getByTitle('Actions'));
    fireEvent.click(screen.getByRole('button', { name: '🗑️ Delete' }));
    expect(screen.getByText('Delete excerpt "Excerpt 2"? This cannot be undone.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(writes).toHaveLength(3));
    expect(writes[2]).toEqual({ method: 'DELETE', path: '/api/chapters/101/excerpts/1012', body: undefined });
    // The reader reopens on the excerpt before the deleted one.
    expect(await screen.findByText('Excerpt 1')).toBeTruthy();
  });

  it('shows image counts and opens the chapter images', async () => {
    const detail = bookDetail(1, 'Book One', 2);
    detail.book.chapterImagesEnabled = true;
    detail.chapters[0].imageCount = 2;
    const { requests } = renderBook(detail);

    const badges = await screen.findAllByTitle('Chapter images');
    expect(badges.map(b => b.textContent)).toEqual(['🖼️ 2', '🖼️']);
    fireEvent.click(badges[0]);
    await waitFor(() => expect(requests).toContain('GET /api/chapters/101/images'));
  });

  it('hides image buttons when the book has chapter images off', async () => {
    renderBook(bookDetail(1, 'Book One', 2));
    await screen.findByText('Book One chapter 1');
    expect(screen.queryByTitle('Chapter images')).toBeNull();
  });

  it('shows an empty state for a book without chapters', async () => {
    renderBook(bookDetail(1, 'Book One', 0));
    expect(await screen.findByText("No chapters yet. Add the book's structure to start logging ideas.")).toBeTruthy();
  });
});

describe('parts', () => {
  it('lists parts in the stored order with ungrouped chapters last, and collapses a part', async () => {
    renderBook(partsBookDetail(1, 'Book One'));

    expect(await screen.findByRole('heading', { name: 'Parts' })).toBeTruthy();
    const titles = () => Array.from(document.querySelectorAll('.part-title')).map(e => e.textContent);
    expect(titles()).toEqual(['Part Two', 'Part One', 'Unassigned chapters']);
    expect(screen.getByText('Part 2')).toBeTruthy();
    expect(screen.getByText('1 chapter · drag each into a part above')).toBeTruthy();
    expect(screen.getByText('Book One chapter 2')).toBeTruthy();

    const toggle = screen.getByRole('button', { name: /Part Two/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Book One chapter 2')).toBeNull();
    expect(screen.getByText('Book One chapter 1')).toBeTruthy();
  });

  it('adds, edits and deletes parts, and adds chapters to a part or ungrouped', async () => {
    const { writes } = renderBook(partsBookDetail(1, 'Book One'));

    fireEvent.click(await screen.findByRole('button', { name: '+ Add Part' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Part I: Foundations'), { target: { value: 'Part Three' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Part' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ method: 'POST', path: '/api/books/1/parts', body: { title: 'Part Three' } });
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add Part' })).toBeNull());

    fireEvent.click(screen.getAllByTitle('Add chapter to this part')[0]);
    fireEvent.change(screen.getByPlaceholderText('e.g. Chapter 1: Introduction'), { target: { value: 'In part two' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Chapter' }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toMatchObject({ method: 'POST', path: '/api/books/1/chapters', body: { title: 'In part two', partId: 11 } });
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add Chapter' })).toBeNull());

    fireEvent.click(screen.getByTitle('Add an ungrouped chapter'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Chapter 1: Introduction'), { target: { value: 'Loose' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Chapter' }));
    await waitFor(() => expect(writes).toHaveLength(3));
    expect(writes[2]).toMatchObject({ method: 'POST', path: '/api/books/1/chapters', body: { title: 'Loose', partId: null } });
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add Chapter' })).toBeNull());

    // Editing a chapter keeps its part.
    fireEvent.click(screen.getAllByTitle('Edit chapter')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(writes).toHaveLength(4));
    expect(writes[3]).toMatchObject({ method: 'PUT', path: '/api/books/1/chapters/102', body: { partId: 11 } });
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit Chapter' })).toBeNull());

    fireEvent.click(screen.getAllByTitle('Edit part')[1]);
    expect(screen.getByDisplayValue('Part One')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(writes).toHaveLength(5));
    expect(writes[4]).toMatchObject({ method: 'PUT', path: '/api/books/1/parts/12', body: { title: 'Part One', orderIndex: 1 } });
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit Part' })).toBeNull());

    fireEvent.click(screen.getAllByTitle('Delete part')[0]);
    expect(screen.getByText('Delete part "Part Two"? This cannot be undone.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(writes).toHaveLength(6));
    expect(writes[5]).toEqual({ method: 'DELETE', path: '/api/books/1/parts/11', body: undefined });
  });

  it('moves a chapter to another part, or out of every part, by dragging', async () => {
    const { writes } = renderBook(partsBookDetail(1, 'Book One'));
    await screen.findByText('Book One chapter 1');
    const handle = (title) => screen.getByText(title).closest('.chapter-item').querySelector('.chapter-drag-handle');
    const partItem = (title) => screen.getAllByText(title).find(e => e.classList.contains('part-title')).closest('.part-item');

    fireEvent.dragStart(handle('Book One chapter 1'), { dataTransfer: {} });
    fireEvent.dragOver(partItem('Part Two'));
    expect(partItem('Part Two').classList.contains('part-item--drag-over')).toBe(true);
    fireEvent.drop(partItem('Part Two'));
    expect(partItem('Part Two').classList.contains('part-item--drag-over')).toBe(false);
    // Moved at once, before the server answers.
    expect(within(partItem('Part Two')).getByText('Book One chapter 1')).toBeTruthy();
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      method: 'PUT', path: '/api/books/1/chapters/order',
      body: { chapters: [{ id: 101, partId: 11, orderIndex: 3 }] },
    });

    await waitFor(() => expect(within(partItem('Part One')).getByText('Book One chapter 1')).toBeTruthy());
    fireEvent.dragStart(handle('Book One chapter 2'), { dataTransfer: {} });
    fireEvent.dragOver(partItem('Unassigned chapters'));
    fireEvent.drop(partItem('Unassigned chapters'));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toMatchObject({
      path: '/api/books/1/chapters/order',
      body: { chapters: [{ id: 102, partId: null, orderIndex: 4 }] },
    });

    // Dropping a chapter where it already is writes nothing.
    await waitFor(() => expect(within(partItem('Part One')).getByText('Book One chapter 1')).toBeTruthy());
    fireEvent.dragStart(handle('Book One chapter 1'), { dataTransfer: {} });
    fireEvent.drop(partItem('Part One'));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(writes).toHaveLength(2);
  });

  it('reorders the chapters of a plain book by dragging', async () => {
    const { writes } = renderBook(bookDetail(1, 'Book One', 3));
    await screen.findByText('Book One chapter 1');
    const card = (title) => screen.getByText(title).closest('.chapter-item');
    const titles = () => [...document.querySelectorAll('.chapter-item .chapter-title')].map(e => e.textContent);
    // jsdom has no layout: put the cards' headers 100px apart.
    ['Book One chapter 1', 'Book One chapter 2', 'Book One chapter 3'].forEach((title, i) => {
      card(title).firstElementChild.getBoundingClientRect = () => ({ top: i * 100, height: 50 });
    });
    const list = document.querySelector('.chapter-list');

    // jsdom's drag events carry no coordinates: add them.
    const dragAt = (type, target, clientY) => {
      const event = createEvent[type](target);
      Object.defineProperty(event, 'clientY', { value: clientY });
      fireEvent(target, event);
    };

    // Over the top half of chapter 1, chapter 3 is shown going in front of it.
    fireEvent.dragStart(card('Book One chapter 3').querySelector('.chapter-drag-handle'), { dataTransfer: {} });
    dragAt('dragOver', list, 10);
    expect(card('Book One chapter 1').classList.contains('chapter-item--drop-before')).toBe(true);
    dragAt('drop', list, 10);

    expect(titles()).toEqual(['Book One chapter 3', 'Book One chapter 1', 'Book One chapter 2']);
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      method: 'PUT', path: '/api/books/1/chapters/order',
      body: { chapters: [
        { id: 103, partId: null, orderIndex: 1 },
        { id: 101, partId: null, orderIndex: 2 },
        { id: 102, partId: null, orderIndex: 3 },
      ] },
    });
  });

  it('lists explanations for export in reading order, numbered across parts', async () => {
    renderBook(partsBookDetail(1, 'Book One'));

    fireEvent.click(await screen.findByRole('button', { name: '📄 Export Explanations' }));
    await screen.findByRole('heading', { name: 'Export Explanations' }, { timeout: 5000 }); // lazily loaded (FE-04)
    const items = within(dialog('Export Explanations')).getAllByRole('listitem').map(li => li.textContent);
    expect(items).toEqual([
      'Part 1 · Part One1.Book One chapter 1',
      'Part 2 · Part Two2.Book One chapter 2',
      '3.Book One chapter 3',
    ]);
  });

  it('imports parts with one request', async () => {
    const { writes } = renderBook(partsBookDetail(1, 'Book One'));

    fireEvent.click(await screen.findByRole('button', { name: 'Import JSON' }));
    expect(screen.getByRole('button', { name: 'Parts' })).toBeTruthy();
    const parts = [{ title: 'P', chapters: [{ title: 'C' }] }];
    fireEvent.change(screen.getByRole('textbox'), { target: { value: JSON.stringify(parts) } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(await screen.findByText('Imported successfully!')).toBeTruthy();
    expect(writes).toEqual([{ method: 'POST', path: '/api/books/1/import', body: { mode: 'ADD', parts } }]);
  });

  it('shows an empty state for a parts book without parts or chapters', async () => {
    const detail = partsBookDetail(1, 'Book One');
    renderBook({ ...detail, parts: [], chapters: [] });
    expect(await screen.findByText('No parts yet. Add parts, then add chapters inside each part.')).toBeTruthy();
  });
});

describe('explanations, bookmarks and saved passages', () => {
  it('opens an explanation for reading and deletes it', async () => {
    const { writes, requests } = renderBook(bookDetail(1, 'Book One', 2));

    fireEvent.click(await screen.findByTitle('View / edit explanation'));
    expect(await screen.findByText('Explanation of Book One chapter 1')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Book One chapter 1 — Explanation' })).toBeTruthy();
    expect(requests).toContain('GET /api/chapters/101/explanation');

    fireEvent.click(screen.getByRole('button', { name: '🗑️ Delete' }));
    fireEvent.click(within(dialog('Confirm')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Explanation of Book One chapter 1')).toBeNull());
    expect(writes).toEqual([{ method: 'DELETE', path: '/api/chapters/101/explanation', body: undefined }]);
  });

  it('writes a new explanation and then shows it for reading', async () => {
    const { writes } = renderBook(bookDetail(1, 'Book One', 2));

    fireEvent.click(await screen.findByTitle('Add explanation'));
    fireEvent.change(await screen.findByTestId('editor'), { target: { value: '<p>Brand new</p>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Brand new')).toBeTruthy();
    expect(screen.queryByTestId('editor')).toBeNull();
    expect(writes[0]).toEqual({ method: 'PUT', path: '/api/chapters/102/explanation', body: { content: '<p>Brand new</p>' } });
  });

  it('continues reading from the latest bookmark and records a new one', async () => {
    const detail = bookDetail(1, 'Book One', 2);
    detail.chapters[1].hasExplanation = true;
    detail.bookmarks = [{ id: 5, chapterId: 102, chapterTitle: 'Book One chapter 2', scrollRatio: 0.5, createdAt: '2026-01-03T10:00:00' }];
    const { writes } = renderBook(detail);

    expect(await screen.findByText('Book One chapter 2', { selector: 'strong' })).toBeTruthy();
    expect(document.querySelector('.continue-reading-meta').textContent).toMatch(/^Last read: Book One chapter 2 · .+ · ~50%$/);
    expect(screen.getByTitle('Continue reading from here')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '▶ Continue reading' }));
    expect(await screen.findByText('Explanation of Book One chapter 2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '🔖 Mark read here' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({ method: 'POST', path: '/api/chapters/102/bookmarks', body: { scrollRatio: 0, note: '' } });
    expect(await screen.findByRole('button', { name: '✓ Saved' })).toBeTruthy();
  });

  it('lists saved passages, jumps to one and deletes one', async () => {
    const detail = bookDetail(1, 'Book One', 2);
    detail.marks = [{
      id: 7, chapterId: 101, chapterTitle: 'Book One chapter 1', chapterOrderIndex: 1,
      quote: 'Explanation', prefix: '', suffix: ' of Book', startOffset: 0, endOffset: 11, note: 'why', createdAt: '2026-01-04T09:00:00',
    }];
    const { writes } = renderBook(detail);

    fireEvent.click(await screen.findByRole('button', { name: '📑 Saved Passages (1)' }));
    const panel = dialog('Saved Passages (1)');
    expect(within(panel).getByText('Explanation')).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Jump to' }));
    expect(await screen.findByText('Explanation of Book One chapter 1')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Saved Passages (1)' })).toBeNull();
    fireEvent.click(screen.getByText('Close', { selector: 'button' }));

    fireEvent.click(screen.getByRole('button', { name: '📑 Saved Passages (1)' }));
    fireEvent.click(within(dialog('Saved Passages (1)')).getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(dialog('Confirm')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(writes).toEqual([{ method: 'DELETE', path: '/api/marks/7', body: undefined }]));
  });

  it('reopens saved passages on the chapter last viewed', async () => {
    const detail = bookDetail(1, 'Book One', 2);
    detail.chapters[1].hasExplanation = true;
    const markIn = (id, chapterId, title) => ({
      id, chapterId, chapterTitle: title, chapterOrderIndex: 1,
      quote: 'Explanation', prefix: '', suffix: ' of Book', startOffset: 0, endOffset: 11, note: '', createdAt: '2026-01-04T09:00:00',
    });
    detail.marks = [markIn(7, 101, 'Book One chapter 1'), markIn(8, 102, 'Book One chapter 2')];
    renderBook(detail);

    fireEvent.click(await screen.findByRole('button', { name: '📑 Saved Passages (2)' }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Chapters' })).getByRole('button', { name: /Book One chapter 2/ }));
    fireEvent.click(within(dialog('Saved Passages (2)')).getByRole('button', { name: 'Jump to' }));
    expect(await screen.findByText('Explanation of Book One chapter 2')).toBeTruthy();
    fireEvent.click(screen.getByText('Close', { selector: 'button' }));

    fireEvent.click(screen.getByRole('button', { name: '📑 Saved Passages (2)' }));
    const active = within(screen.getByRole('navigation', { name: 'Chapters' })).getByRole('button', { current: true });
    expect(active.textContent).toContain('Book One chapter 2');
  });

  it('opens the explanation named in the navigation state (Reading History)', async () => {
    const detail = bookDetail(1, 'Book One', 2);
    detail.chapters[1].hasExplanation = true;
    const { requests } = renderBook(detail, { openExplanation: { chapterId: 102, scrollRatio: 0.3 } });

    expect(await screen.findByText('Explanation of Book One chapter 2')).toBeTruthy();
    expect(requests.filter(r => r === 'GET /api/chapters/102/explanation')).toHaveLength(1);
  });
});
