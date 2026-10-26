import { useMemo, useState } from 'react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';

const QUOTE_PREVIEW_CHARS = 280;
const NOTE_MAX = 1000;

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Lists every passage saved from this book's explanations, grouped by chapter,
// with jump / edit-note / delete actions.
export default function ExplanationMarksPanel({
  marks,
  staleIds = {},
  onJump,
  onUpdateNote,
  onDelete,
  onClose,
}) {
  const [expanded, setExpanded] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const groups = useMemo(() => {
    const byChapter = new Map();
    for (const mark of marks) {
      if (!byChapter.has(mark.chapterId)) {
        byChapter.set(mark.chapterId, { chapterId: mark.chapterId, title: mark.chapterTitle, items: [] });
      }
      byChapter.get(mark.chapterId).items.push(mark);
    }
    return [...byChapter.values()];
  }, [marks]);

  const startEdit = (mark) => {
    setEditingId(mark.id);
    setNoteDraft(mark.note || '');
    setError('');
  };

  const saveNote = async (mark) => {
    setBusy(true);
    setError('');
    try {
      await onUpdateNote(mark.id, noteDraft.trim());
      setEditingId(null);
    } catch {
      setError('Could not save the note. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    setError('');
    try {
      await onDelete(target.id);
    } catch {
      setError('Could not delete the passage. Try again.');
    }
  };

  return (
    <>
    <Modal size="lg" title={`Saved Passages (${marks.length})`} onClose={onClose} closeOnEsc={!deleteTarget && editingId == null}>
      {error && <div className="marks-error" role="alert">{error}</div>}
      {marks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📑</div>
          <div className="empty-state-text">No saved passages yet.</div>
          <div className="empty-state-hint">Open a chapter explanation and select some text to save it here.</div>
        </div>
      ) : (
        <div className="marks-panel">
          {groups.map(group => (
            <section key={group.chapterId} className="marks-group">
              <h4 className="marks-group-title">{group.title || 'Chapter'}</h4>
              {group.items.map(mark => {
                const long = mark.quote.length > QUOTE_PREVIEW_CHARS;
                const isOpen = !!expanded[mark.id];
                const shown = long && !isOpen ? `${mark.quote.slice(0, QUOTE_PREVIEW_CHARS).trimEnd()}…` : mark.quote;
                return (
                  <article key={mark.id} className="marks-item">
                    <blockquote className="marks-quote">{shown}</blockquote>
                    {long && (
                      <button
                        type="button"
                        className="btn-link marks-expand"
                        onClick={() => setExpanded(prev => ({ ...prev, [mark.id]: !isOpen }))}
                      >
                        {isOpen ? 'Show less' : 'Show more'}
                      </button>
                    )}
                    {editingId === mark.id ? (
                      <div className="marks-note-edit">
                        <input
                          type="text"
                          className="form-input"
                          value={noteDraft}
                          maxLength={NOTE_MAX}
                          autoFocus
                          placeholder="Add a note (optional)"
                          aria-label="Note"
                          onChange={(e) => setNoteDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); saveNote(mark); }
                            if (e.key === 'Escape') { e.stopPropagation(); setEditingId(null); }
                          }}
                        />
                        <button className="btn btn-primary btn-sm" onClick={() => saveNote(mark)} disabled={busy}>Save</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)} disabled={busy}>Cancel</button>
                      </div>
                    ) : (
                      mark.note && <p className="marks-note">{mark.note}</p>
                    )}
                    <div className="marks-meta">
                      <span>{formatTime(mark.createdAt)}</span>
                      {staleIds[mark.id] && (
                        <span className="marks-stale" title="The explanation changed; the passage could not be found">
                          ⚠ Position may have changed
                        </span>
                      )}
                      <span style={{ flex: 1 }} />
                      <button className="btn btn-primary btn-sm" onClick={() => onJump(mark)}>Jump to</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => startEdit(mark)}>
                        {mark.note ? 'Edit note' : 'Add note'}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(mark)}>Delete</button>
                    </div>
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </Modal>

    {deleteTarget && (
      <ConfirmDialog
        message="Delete this saved passage? This cannot be undone."
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    )}
    </>
  );
}
