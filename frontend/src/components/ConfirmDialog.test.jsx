import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ConfirmDialog from './ConfirmDialog';

afterEach(cleanup);

describe('ConfirmDialog', () => {
  it('disables both buttons while the action runs, so it is not sent twice', async () => {
    let finish;
    const onConfirm = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    render(<ConfirmDialog message="Delete it?" onConfirm={onConfirm} onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('button', { name: 'Delete' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Cancel' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    finish();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' }).disabled).toBe(false));
  });

  it('takes a title and a label for the action', () => {
    render(<ConfirmDialog title="Remove" message="Remove it?" confirmLabel="Remove" onConfirm={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Remove' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
  });

  it('closes on Esc without the key reaching the dialog underneath', () => {
    const onClose = vi.fn();
    const underneath = vi.fn();
    document.addEventListener('keydown', underneath);
    render(<ConfirmDialog message="Delete it?" onConfirm={() => {}} onClose={onClose} />);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    document.removeEventListener('keydown', underneath);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(underneath).not.toHaveBeenCalled();
  });
});
