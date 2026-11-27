import { describe, expect, it } from 'vitest';
import { bookImport, structureImport } from './jsonImport';

describe('jsonImport request bodies', () => {
  it('wraps one book or many, keeping everything nested in them', () => {
    const book = { title: 'B', chapters: [{ title: 'C', summary: 's' }] };
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
});
