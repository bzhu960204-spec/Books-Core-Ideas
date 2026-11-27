import ReactMarkdown from 'react-markdown';

// A chapter row: header with badges and actions. Clicking the header opens the
// chapter's explanation. The ⠿ handle drags it to another position or part.
// `actions` holds the page's handlers (see BookDetailPage).
export default function ChapterCard({
  chapter,
  idx,
  imagesEnabled,
  hasBookmark,
  latestBookmark,
  dragHandle,
  dragging,
  dropIndicator,
  actions,
}) {
  const isLatestBookmark = latestBookmark?.chapterId === chapter.id;
  const className = ['chapter-item']
    .concat(dragging ? 'chapter-item--dragging' : [], dropIndicator ? `chapter-item--drop-${dropIndicator}` : [])
    .join(' ');

  return (
    <div className={className} data-chapter-id={chapter.id}>
      <div className="chapter-header" onClick={() => actions.openExplanation(chapter.id)}>
        <div className="chapter-header-left">
          <span
            className="chapter-drag-handle"
            draggable
            onClick={e => e.stopPropagation()}
            {...dragHandle}
            title="Drag to reorder this chapter or move it to another part"
          >⠿</span>
          <span className="chapter-number">{chapter.orderIndex || idx + 1}</span>
          <div>
            <div className="chapter-title">{chapter.title}</div>
            {chapter.summary && <div className="chapter-summary"><ReactMarkdown>{chapter.summary}</ReactMarkdown></div>}
          </div>
        </div>
        <div className="chapter-actions" onClick={e => e.stopPropagation()}>
          {imagesEnabled && (
            <button
              className="btn-icon image-badge"
              title="Chapter images"
              onClick={() => actions.openImages(chapter.id)}
            >🖼️{chapter.imageCount > 0 ? ` ${chapter.imageCount}` : ''}</button>
          )}
          {(chapter.hasExplanation || chapter.favorite) && (
            <button
              className={`btn-icon chapter-favorite${chapter.favorite ? ' chapter-favorite--on' : ''}`}
              title={chapter.favorite ? 'Remove from Favorite Chapters' : 'Add to Favorite Chapters'}
              aria-pressed={!!chapter.favorite}
              onClick={() => actions.toggleFavorite(chapter)}
            >{chapter.favorite ? '★' : '☆'}</button>
          )}
          <button
            className="btn-icon"
            title={chapter.hasExplanation ? 'View / edit explanation' : 'Add explanation'}
            onClick={() => actions.openExplanation(chapter.id)}
            style={{ opacity: chapter.hasExplanation ? 1 : 0.5 }}
          >📄{chapter.hasExplanation ? '✓' : ''}</button>
          {hasBookmark && (
            <button
              className="btn-icon"
              title={isLatestBookmark ? 'Continue reading from here' : 'You have a reading bookmark here'}
              onClick={() => actions.openExplanation(
                chapter.id,
                false,
                isLatestBookmark ? (latestBookmark.scrollRatio ?? 0) : null,
              )}
              style={{ opacity: isLatestBookmark ? 1 : 0.55 }}
            >🔖</button>
          )}
          <button
            className="btn-icon"
            title="Edit chapter"
            onClick={() => actions.editChapter(chapter)}
          >✏️</button>
          <button
            className="btn-icon"
            title="Delete chapter"
            onClick={() => actions.deleteChapter(chapter)}
          >🗑️</button>
        </div>
      </div>
    </div>
  );
}
