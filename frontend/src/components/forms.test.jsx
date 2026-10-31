import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import BookForm from './BookForm';
import ChapterForm from './ChapterForm';
import PartForm from './PartForm';
import IdeaForm from './IdeaForm';
import ExcerptForm from './ExcerptForm';

vi.mock('../api', () => ({
  bookApi: { getCategories: vi.fn(() => Promise.resolve([])) },
}));

afterEach(cleanup);

function submit(onSave) {
  fireEvent.submit(document.querySelector('form'));
  expect(onSave).toHaveBeenCalledTimes(1);
  return onSave.mock.calls[0][0];
}

describe('edit forms seed their fields from the entity being edited', () => {
  it('BookForm', () => {
    const onSave = vi.fn();
    render(<BookForm
      book={{
        title: 'Deep Work', author: 'Cal Newport', isbn: '123', description: 'Focus',
        coverUrl: '', category: 'Productivity; Work', readingStatus: 'READING',
        chapterImagesEnabled: true, structureType: 'PARTS',
      }}
      onSave={onSave}
      onClose={() => {}}
    />);
    expect(screen.getByText('Edit Book')).toBeTruthy();
    expect(screen.getByDisplayValue('Deep Work')).toBeTruthy();
    expect(screen.getByDisplayValue('Cal Newport')).toBeTruthy();
    expect(submit(onSave)).toMatchObject({
      title: 'Deep Work',
      categories: ['Productivity', 'Work'],
      category: 'Productivity;Work',
      readingStatus: 'READING',
      chapterImagesEnabled: true,
      structureType: 'PARTS',
    });
  });

  it('BookForm starts empty for a new book', () => {
    render(<BookForm book={null} onSave={() => {}} onClose={() => {}} />);
    expect(screen.getByText('Add New Book')).toBeTruthy();
    expect(document.querySelector('form input').value).toBe('');
  });

  it.each([
    ['ChapterForm', ChapterForm, 'chapter', { title: 'Ch 3', orderIndex: 3, summary: 'S' }, { title: 'Ch 3', orderIndex: 3, summary: 'S' }],
    ['PartForm', PartForm, 'part', { title: 'Part II', orderIndex: 2, summary: '' }, { title: 'Part II', orderIndex: 2, summary: '' }],
    ['IdeaForm', IdeaForm, 'idea', { content: 'Idea', example: 'Ex', tags: 'a,b', orderIndex: 4 }, { content: 'Idea', example: 'Ex', tags: 'a,b', orderIndex: 4 }],
    ['ExcerptForm', ExcerptForm, 'excerpt', { content: 'Quote', note: 'N', source: 'p.1', orderIndex: 5 }, { content: 'Quote', note: 'N', source: 'p.1', orderIndex: 5 }],
  ])('%s', (_name, Form, prop, entity, expected) => {
    const onSave = vi.fn();
    render(<Form {...{ [prop]: entity }} onSave={onSave} onClose={() => {}} />);
    expect(screen.getByDisplayValue(entity.title ?? entity.content)).toBeTruthy();
    expect(submit(onSave)).toMatchObject(expected);
  });

  it.each([
    ['ChapterForm', ChapterForm, 'chapter'],
    ['PartForm', PartForm, 'part'],
    ['IdeaForm', IdeaForm, 'idea'],
    ['ExcerptForm', ExcerptForm, 'excerpt'],
  ])('%s starts empty with order 1 for a new entry', (_name, Form, prop) => {
    render(<Form {...{ [prop]: null }} onSave={() => {}} onClose={() => {}} />);
    const fields = Array.from(document.querySelectorAll('form input, form textarea'));
    expect(fields[0].value).toBe('');
    expect(screen.getByDisplayValue('1')).toBeTruthy();
  });
});
