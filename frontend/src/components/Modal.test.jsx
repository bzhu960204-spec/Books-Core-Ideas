import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import Modal from './Modal';

afterEach(cleanup);

describe('Modal layout', () => {
  it.each(['md', 'lg'])('keeps the close button and title outside the scrolling body (%s)', (size) => {
    render(<Modal size={size} title="Title" onClose={() => {}}><p>content</p></Modal>);
    const body = document.querySelector('.modal-body');
    expect(body.contains(screen.getByText('content'))).toBe(true);
    expect(body.contains(screen.getByRole('button', { name: 'Close' }))).toBe(false);
    expect(body.contains(screen.getByRole('heading', { name: 'Title' }))).toBe(false);
  });

  it('leaves the layout of xl modals to the caller', () => {
    render(<Modal size="xl" title="Title" onClose={() => {}}><p>content</p></Modal>);
    expect(document.querySelector('.modal-body')).toBeNull();
  });

  it('renders headerActions before the close button', () => {
    render(<Modal title="Title" onClose={() => {}} headerActions={<button type="button">Extra</button>}><p>x</p></Modal>);
    const corner = document.querySelector('.modal-corner');
    const buttons = [...corner.querySelectorAll('button')].map(b => b.textContent);
    expect(buttons).toEqual(['Extra', '×']);
  });

  it('only has the close button in the corner without headerActions', () => {
    render(<Modal title="Title" onClose={() => {}}><p>x</p></Modal>);
    expect(document.querySelectorAll('.modal-corner button')).toHaveLength(1);
  });
});
