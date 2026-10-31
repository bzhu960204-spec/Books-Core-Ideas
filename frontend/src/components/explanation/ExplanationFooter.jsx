import { highlightsSupported } from '../../utils/explanationAnchor';

// The reader's bottom bar. Editing: fullscreen, Cancel (only when there is saved
// content to return to), Save. Reading: fullscreen, font size, highlights,
// bookmark, Delete, Close, Edit.
export default function ExplanationFooter({
  editing,
  fullscreen,
  onToggleFullscreen,
  hasContent,
  saving,
  onCancelEdit,
  onSave,
  prefs,
  bookmarking,
  bookmarkSaved,
  onBookmark,
  onDelete,
  onClose,
  onEdit,
}) {
  return (
    <footer className="review-reader-actions">
      {editing ? (
        <>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onToggleFullscreen}
            title={fullscreen ? 'Exit fullscreen (Esc)' : 'Distraction-free editing'}
          >
            {fullscreen ? '⤡ Exit Fullscreen' : '⛶ Fullscreen'}
          </button>
          <span style={{ flex: 1 }} />
          {hasContent && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={onCancelEdit}
              disabled={saving}
            >
              Cancel
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onToggleFullscreen}
            title={fullscreen ? 'Exit fullscreen (Esc)' : 'Distraction-free reading'}
          >
            {fullscreen ? '⤡ Exit Fullscreen' : '⛶ Fullscreen'}
          </button>
          <div className="reader-font-controls" role="group" aria-label="Font size">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={prefs.shrinkFont}
              disabled={!prefs.canShrinkFont}
              title="Smaller text"
              aria-label="Smaller text"
            >
              A−
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={prefs.growFont}
              disabled={!prefs.canGrowFont}
              title="Larger text"
              aria-label="Larger text"
            >
              A+
            </button>
          </div>
          {highlightsSupported() && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={prefs.toggleHighlights}
              aria-pressed={prefs.showHighlights}
              title={prefs.showHighlights ? 'Hide highlights of saved passages' : 'Show highlights of saved passages'}
              style={{ marginLeft: '0.35rem' }}
            >
              🖍 Highlights: {prefs.showHighlights ? 'On' : 'Off'}
            </button>
          )}
          <span style={{ flex: 1 }} />
          {hasContent && (
            <button
              className="btn btn-primary btn-sm"
              onClick={onBookmark}
              disabled={bookmarking}
              title="Save your reading position so you can continue later"
            >
              {bookmarkSaved ? '✓ Saved' : (bookmarking ? 'Saving…' : '🔖 Mark read here')}
            </button>
          )}
          <button className="btn btn-danger btn-sm" onClick={onDelete}>
            🗑️ Delete
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary btn-sm" onClick={onEdit}>
            ✏️ Edit
          </button>
        </>
      )}
    </footer>
  );
}
