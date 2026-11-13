import ReactMarkdown from 'react-markdown';

// A chapter row: header with badges and actions (click to expand), and when
// expanded, its key ideas. The ⠿ handle drags it to another position or part.
// `actions` holds the page's handlers (see BookDetailPage).
export default function ChapterCard({
  chapter,
  idx,
  imagesEnabled,
  expanded,
  hasBookmark,
  latestBookmark,
  dragHandle,
  dragging,
  dropIndicator,
  cardRef,
  actions,
}) {
  const ideas = chapter.keyIdeas;
  const excerpts = chapter.excerpts;
  const isLatestBookmark = latestBookmark?.chapterId === chapter.id;
  const className = ['chapter-item']
    .concat(dragging ? 'chapter-item--dragging' : [], dropIndicator ? `chapter-item--drop-${dropIndicator}` : [])
    .join(' ');

  return (
    <div className={className} ref={cardRef} data-chapter-id={chapter.id}>
      <div className="chapter-header" onClick={() => actions.toggleChapter(chapter.id)}>
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
          <button
            className="btn-icon"
            title="Import JSON for this chapter"
            onClick={() => actions.importIntoChapter(chapter.id)}
            style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '-0.05em' }}
          >{'{}'}</button>
          {imagesEnabled && (
            <button
              className="btn-icon image-badge"
              title="Chapter images"
              onClick={() => actions.openImages(chapter.id)}
            >🖼️{chapter.imageCount > 0 ? ` ${chapter.imageCount}` : ''}</button>
          )}
          {excerpts && excerpts.length > 0 && (
            <button
              className="btn-icon excerpt-badge"
              title="Read excerpts"
              onClick={() => actions.readExcerpts(chapter.id)}
            >📖 {excerpts.length}</button>
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
          <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="chapter-body">
          {(!ideas || ideas.length === 0) ? (
            <div className="empty-state" style={{ padding: '1.5rem' }}>
              <p className="empty-state-text" style={{ fontSize: '0.85rem' }}>
                No key ideas yet for this chapter.
              </p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => actions.addIdea(chapter.id)}
              >
                + Add First Idea
              </button>
            </div>
          ) : (
            <div className="idea-list">
              {ideas.map(idea => (
                <div key={idea.id} className="idea-card">
                  <div className="idea-content"><ReactMarkdown>{idea.content}</ReactMarkdown></div>
                  {idea.example && (
                    <div className="idea-example"><ReactMarkdown>{idea.example}</ReactMarkdown></div>
                  )}
                  <div className="idea-actions">
                    <button
                      className="btn-icon"
                      title={idea.highlighted ? 'Remove from Idea Bank' : 'Add to Idea Bank'}
                      onClick={() => actions.toggleIdeaHighlight(idea, chapter.id)}
                      style={{
                        color: idea.highlighted ? '#FFD54F' : 'var(--text-secondary)',
                        fontSize: '1.05rem',
                        opacity: idea.highlighted ? 1 : 0.45,
                        transition: 'color 0.2s, opacity 0.2s',
                      }}
                    >
                      {idea.highlighted ? '★' : '☆'}
                    </button>
                    <button
                      className="btn-icon"
                      title="Edit idea"
                      onClick={() => actions.editIdea(idea, chapter.id)}
                    >✏️</button>
                    <button
                      className="btn-icon"
                      title="Delete idea"
                      onClick={() => actions.deleteIdea(idea, chapter.id)}
                    >🗑️</button>
                  </div>
                </div>
              ))}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => actions.addIdea(chapter.id)}
                style={{ alignSelf: 'flex-start' }}
              >
                + Add Idea
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
