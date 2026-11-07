const NOTE_MAX = 1000;

// The floating bar next to the selected passage ("Save passage" / note / "Already
// saved" + Remove), the one just saved ("Passage saved" / Undo) or the one just
// removed ("Highlight removed" / Undo). mouseDown is prevented outside the note
// input so clicking a button keeps the text selection.
export default function PassageMenu({ menuRef, passages, duplicate }) {
  const {
    selection, noteOpen, setNoteOpen, noteDraft, setNoteDraft, savingMark, markError, save, undo,
    removedNotice, removeSelected, undoRemove,
  } = passages;
  const showingRemoved = !selection && !passages.savedNotice && !!removedNotice;

  return (
    <div
      ref={menuRef}
      className="mark-menu"
      role={selection ? 'region' : 'status'}
      aria-label={selection ? 'Save selected passage' : undefined}
      onMouseDown={(e) => { if (e.target.tagName !== 'INPUT') e.preventDefault(); }}
    >
      {selection ? (
        <>
          {noteOpen && (
            <input
              type="text"
              className="form-input mark-menu-input"
              placeholder="Add a note (optional)"
              aria-label="Note"
              maxLength={NOTE_MAX}
              value={noteDraft}
              autoFocus
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); save(); }
                if (e.key === 'Escape') { e.stopPropagation(); setNoteOpen(false); }
              }}
            />
          )}
          {duplicate ? (
            <>
              <span className="mark-menu-status">✓ Already saved</span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => removeSelected(duplicate)}
                title="Remove this highlight"
              >
                🗑 Remove
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={savingMark}>
                {savingMark ? 'Saving…' : (noteOpen ? 'Save' : '📑 Save passage')}
              </button>
              {!noteOpen && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setNoteOpen(true)}
                  title="Save with a note"
                >
                  ✎ Note
                </button>
              )}
            </>
          )}
          {markError && <span className="mark-menu-error">{markError}</span>}
        </>
      ) : showingRemoved ? (
        <>
          <span className="mark-menu-status">✓ Highlight removed</span>
          <button className="btn btn-secondary btn-sm" onClick={undoRemove}>Undo</button>
          {markError && <span className="mark-menu-error">{markError}</span>}
        </>
      ) : (
        <>
          <span className="mark-menu-status">✓ Passage saved</span>
          <button className="btn btn-secondary btn-sm" onClick={undo}>Undo</button>
          {markError && <span className="mark-menu-error">{markError}</span>}
        </>
      )}
    </div>
  );
}
