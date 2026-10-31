import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ExcerptReader from './ExcerptReader';

afterEach(cleanup);

const excerpts = [
  { id: 1, content: 'First passage' },
  { id: 2, content: 'Second passage' },
];

describe('ExcerptReader', () => {
  it('closes the actions menu when moving to another excerpt', () => {
    render(<ExcerptReader excerpts={excerpts} chapterTitle="Ch" onClose={() => {}} onEdit={() => {}} onDelete={() => {}} />);

    fireEvent.click(screen.getByTitle('Actions'));
    expect(screen.getByRole('button', { name: /Delete/ })).toBeTruthy();

    fireEvent.keyDown(document, { key: 'ArrowRight' });

    expect(screen.getByText('Second passage')).toBeTruthy();
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
  });

  it('keeps the menu open while staying on the same excerpt', () => {
    render(<ExcerptReader excerpts={excerpts} startIndex={1} chapterTitle="Ch" onClose={() => {}} onEdit={() => {}} onDelete={() => {}} />);

    fireEvent.click(screen.getByTitle('Actions'));
    fireEvent.keyDown(document, { key: 'ArrowRight' });

    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Delete/ })).toBeTruthy();
  });
});
