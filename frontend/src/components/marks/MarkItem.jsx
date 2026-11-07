import { useState } from 'react';

const QUOTE_PREVIEW_CHARS = 280;

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// One saved passage: quote, note, time and its actions. Clicking the quote or
// Add / Edit note opens the panel's focus dialog; notes are edited only there.
export default function MarkItem({
  mark,
  stale,
  onFocus,
  onJump,
  onDelete,
}) {
  const [expanded, setExpanded] = useState(false);

  const long = mark.quote.length > QUOTE_PREVIEW_CHARS;
  const shown = long && !expanded ? `${mark.quote.slice(0, QUOTE_PREVIEW_CHARS).trimEnd()}…` : mark.quote;

  const openFromQuote = (e) => {
    // Dragging to select text for copying must not open the dialog.
    const selection = window.getSelection?.();
    if (selection && !selection.isCollapsed && selection.toString() !== ''
      && e.currentTarget.contains(selection.anchorNode)) return;
    onFocus(mark);
  };

  const onQuoteKeyDown = (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onFocus(mark);
    }
  };

  return (
    <article className="marks-item" data-mark-id={mark.id}>
      <blockquote
        className="marks-quote is-clickable"
        role="button"
        tabIndex={0}
        title="Focus on this passage"
        aria-label="Focus on this passage"
        onClick={openFromQuote}
        onKeyDown={onQuoteKeyDown}
      >{shown}</blockquote>
      {long && (
        <button
          type="button"
          className="btn-link marks-expand"
          onClick={() => setExpanded(prev => !prev)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
      {mark.note && <p className="marks-note">{mark.note}</p>}
      <div className="marks-meta">
        <span>{formatTime(mark.createdAt)}</span>
        {stale && (
          <span className="marks-stale" title="The explanation changed; the passage could not be found">
            ⚠ Position may have changed
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm" onClick={() => onJump(mark)}>Jump to</button>
        <button className="btn btn-secondary btn-sm" onClick={() => onFocus(mark, { editNote: true })}>
          {mark.note ? 'Edit note' : 'Add note'}
        </button>
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(mark)}>Delete</button>
      </div>
    </article>
  );
}
