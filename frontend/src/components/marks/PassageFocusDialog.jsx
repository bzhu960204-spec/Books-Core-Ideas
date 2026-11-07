import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Modal from '../Modal';
import ConfirmDialog from '../ConfirmDialog';

const NOTE_MAX = 1000;
const SAVED_FLASH_MS = 2000;

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const isTypingTarget = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
};

// One passage in full, with its surrounding text and a multi-line note editor.
// The note is saved explicitly; leaving with an unsaved draft asks first.
export default function PassageFocusDialog({
  marks,
  markId,
  chapterTitle,
  staleIds = {},
  onNavigate,
  onSaveNote,
  onJump,
  onDelete,
  onClose,
}) {
  const index = marks.findIndex(m => m.id === markId);
  const mark = index >= 0 ? marks[index] : null;

  // Draft state is reset while rendering when another passage is shown.
  const [state, setState] = useState({ id: markId, draft: mark?.note || '', baseline: (mark?.note || '').trim() });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [pending, setPending] = useState(null);
  const textareaRef = useRef(null);

  if (state.id !== markId) {
    setState({ id: markId, draft: mark?.note || '', baseline: (mark?.note || '').trim() });
    setError('');
    setSavedFlash(false);
    setPending(null);
  }
  const { draft, baseline } = state;

  const dirty = draft.trim() !== baseline;

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [markId]);

  useEffect(() => {
    if (!savedFlash) return undefined;
    const timer = setTimeout(() => setSavedFlash(false), SAVED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [savedFlash]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    if (el.scrollHeight > 0) {
      el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.4)}px`;
    }
  }, [draft, markId]);

  const prevId = index > 0 ? marks[index - 1].id : null;
  const nextId = index >= 0 && index < marks.length - 1 ? marks[index + 1].id : null;

  const guard = (action) => {
    if (dirty) setPending(() => action);
    else action();
  };

  useEffect(() => {
    if (pending) return undefined;
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (isTypingTarget(e.target)) return;
      const targetId = e.key === 'ArrowLeft' ? prevId : nextId;
      if (targetId == null) return;
      e.preventDefault();
      if (dirty) setPending(() => () => onNavigate(targetId));
      else onNavigate(targetId);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pending, prevId, nextId, dirty, onNavigate]);

  if (!mark) return null;

  const save = async () => {
    if (!dirty || saving) return;
    const note = draft.trim();
    setSaving(true);
    setError('');
    try {
      await onSaveNote(mark, note);
      setState(prev => (prev.id === mark.id ? { ...prev, baseline: note } : prev));
      setSavedFlash(true);
    } catch {
      setError('Could not save the note. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const prefix = mark.prefix || '';
  const suffix = mark.suffix || '';

  return (
    <>
      <Modal
        size="lg"
        className="passage-focus-modal"
        title={chapterTitle || 'Chapter'}
        onClose={() => guard(onClose)}
        closeOnEsc={!pending}
      >
        <div className="passage-focus-scroll">
          <div className="passage-focus-sub">
            <span>Passage {index + 1} of {marks.length}</span>
            {formatTime(mark.createdAt) && <span>· {formatTime(mark.createdAt)}</span>}
            {staleIds[mark.id] && (
              <span className="marks-stale" title="The explanation changed; the passage could not be found">
                ⚠ Position may have changed
              </span>
            )}
          </div>

          <div className="passage-focus-text">
            {prefix && <span className="passage-focus-context">…{prefix}</span>}
            <span className="passage-focus-quote">{mark.quote}</span>
            {suffix && <span className="passage-focus-context">{suffix}…</span>}
          </div>

          <div className="passage-focus-note-head">
            <label htmlFor="passage-focus-note">Note</label>
            <span className="passage-focus-count">{draft.length} / {NOTE_MAX}</span>
          </div>
          <textarea
            id="passage-focus-note"
            ref={textareaRef}
            className="form-input passage-focus-note"
            rows={4}
            maxLength={NOTE_MAX}
            autoFocus
            value={draft}
            placeholder="Write your thoughts about this passage…"
            onChange={(e) => {
              const value = e.target.value;
              setState(prev => ({ ...prev, draft: value }));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                save();
              }
            }}
          />
          <div className="passage-focus-save">
            {error && <span className="marks-error" role="alert">{error}</span>}
            {savedFlash && !error && <span className="passage-focus-saved" role="status">Saved ✓</span>}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={save}
              disabled={!dirty || saving}
            >Save note</button>
          </div>
        </div>

        <div className="passage-focus-footer">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={prevId == null}
            onClick={() => guard(() => onNavigate(prevId))}
          >← Previous</button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={nextId == null}
            onClick={() => guard(() => onNavigate(nextId))}
          >Next →</button>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => guard(() => onJump(mark))}>Jump to</button>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => guard(() => onDelete(mark))}>Delete</button>
        </div>
      </Modal>

      {pending && (
        <ConfirmDialog
          title="Unsaved note"
          message="Discard the changes to this note?"
          confirmLabel="Discard"
          onConfirm={() => {
            const action = pending;
            setPending(null);
            action();
          }}
          onClose={() => setPending(null)}
        />
      )}
    </>
  );
}
