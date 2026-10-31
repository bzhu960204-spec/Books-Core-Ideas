import { describe, expect, it } from 'vitest';
import { bookImport, chapterContentImport, groupedContentImport, structureImport } from './jsonImport';

describe('jsonImport request bodies', () => {
  it('wraps one book or many, keeping everything nested in them', () => {
    const book = { title: 'B', chapters: [{ title: 'C', keyIdeas: [{ content: 'i' }], excerpts: [{ content: 'e' }] }] };
    expect(bookImport(book)).toEqual({ books: [book] });
    expect(bookImport([book, { title: 'B2' }]).books).toHaveLength(2);
    expect(() => bookImport(['not a book'])).toThrow('Each book must be a JSON object.');
  });

  it('sends parts to a PARTS book and chapters to a CHAPTERS book', () => {
    expect(structureImport([{ title: 'P', chapters: [] }], 'replace', true))
      .toEqual({ mode: 'REPLACE', parts: [{ title: 'P', chapters: [] }] });
    expect(structureImport({ title: 'C' }, 'add', false)).toEqual({ mode: 'ADD', chapters: [{ title: 'C' }] });
    expect(() => structureImport([{ title: 'P', chapters: [] }], 'add', false)).toThrow('looks like a Parts structure');
  });

  it('names grouped content by chapter title and requires the tab\'s array', () => {
    expect(groupedContentImport([{ chapter: 'Ch 1', ideas: [{ content: 'i' }], excerpts: [{ content: 'ignored' }] }], 'add', 'ideas'))
      .toEqual({ mode: 'ADD', chapters: [{ chapter: 'Ch 1', ideas: [{ content: 'i' }] }] });
    expect(() => groupedContentImport([{ ideas: [] }], 'add', 'ideas')).toThrow('"chapter" field');
    expect(() => groupedContentImport([{ chapter: 'Ch 1', ideas: [] }], 'add', 'excerpts'))
      .toThrow('"excerpts" array is required for chapter "Ch 1"');
  });

  it('names a chapter\'s own content by id; combined sends only the kinds given', () => {
    expect(chapterContentImport([{ content: 'e' }], 'replace', 7, 'excerpts'))
      .toEqual({ mode: 'REPLACE', chapters: [{ chapterId: 7, excerpts: [{ content: 'e' }] }] });
    expect(chapterContentImport({ ideas: [{ content: 'i' }] }, 'add', 7, 'combined'))
      .toEqual({ mode: 'ADD', chapters: [{ chapterId: 7, ideas: [{ content: 'i' }], excerpts: undefined }] });
    expect(() => chapterContentImport({}, 'add', 7, 'combined')).toThrow('"ideas" and/or "excerpts"');
  });
});
