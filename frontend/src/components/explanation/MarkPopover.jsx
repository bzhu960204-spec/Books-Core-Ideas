import { useLayoutEffect, useState } from 'react';
import { isoDay } from '../../utils/dates';

const NOTE_MAX = 1000;

// The card shown over a saved passage: its note, with Edit / Remove. `editing`
// lives with the hover state (Esc cancels it there); the draft and request
// state live here. mouseDown is prevented outside the textarea so clicking a
// button does not disturb the text selection.
export default function MarkPopover({
  popoverRef, mark, pinned, editing, onEditingChange, onClose, onUpdateNote, onRemove, onLayout,
  onPointerEnter, onPointerLeave,
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(null); // 'saving' | 'removing' | null
  const [noteError, setNoteError] = useState(false);
  const [removeError, setRemoveError] = useState(false);

  // The card changes height (view / edit), so it re-places itself after every render.
  useLayoutEffect(() => { onLayout?.(); });

  const startEdit = () => {
    setDraft(mark.note || '');
    setNoteError(false);
    onEditingChange(true);
  };

  const saveNote = async () => {
    if (busy) return;
    setBusy('saving');
    setNoteError(false);
    try {
      await onUpdateNote?.(mark.id, draft.trim());
      onEditingChange(false);
    } catch {
      setNoteError(true);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy('removing');
    setRemoveError(false);
    try {
      await onRemove?.();
    } catch {
      setRemoveError(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      ref={popoverRef}
      className="mark-popover"
      role="dialog"
      aria-label="Saved passage note"
      onMouseDown={(e) => { if (e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="mark-popover-head">
        <span>📝 Note</span>
        {pinned && (
          <button className="mark-popover-close" onClick={onClose} aria-label="Close note" title="Close">×</button>
        )}
      </div>
      {editing ? (
        <textarea
          className="form-input mark-popover-input"
          aria-label="Note"
          placeholder="Add a note (optional)"
          maxLength={NOTE_MAX}
          rows={3}
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveNote(); }
          }}
        />
      ) : (
        <div className={`mark-popover-note ${mark.note ? '' : 'is-empty'}`}>{mark.note || 'No note'}</div>
      )}
      <div className="mark-popover-foot">
        {mark.createdAt && <span className="mark-popover-date">Saved {isoDay(mark.createdAt)}</span>}
        <span className="mark-popover-actions">
          {editing ? (
            <>
              <button className="btn btn-primary btn-sm" onClick={saveNote} disabled={!!busy}>
                {busy === 'saving' ? 'Saving…' : 'Save'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => onEditingChange(false)} disabled={!!busy}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary btn-sm" onClick={startEdit} disabled={!!busy}>
                {mark.note ? '✎ Edit' : '✎ Add note'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={remove} disabled={!!busy}>
                {busy === 'removing' ? 'Removing…' : '🗑 Remove'}
              </button>
            </>
          )}
        </span>
      </div>
      {editing && noteError && <div className="mark-popover-error">Could not save the note. Try again.</div>}
      {!editing && removeError && <div className="mark-popover-error">Could not remove. Try again.</div>}
    </div>
  );
}
