import ReactMarkdown from 'react-markdown';

// A parts book's structure: each part (collapsible, a drop target for dragged
// chapters) with its chapters, then the chapters whose part is missing (null or
// stale) in an "Ungrouped" bucket so they stay visible and draggable.
export default function PartList({
  parts,
  chapters,
  collapsedParts,
  onTogglePart,
  dragOverPartId,
  dropTarget,
  onAddChapter,
  onEditPart,
  onDeletePart,
  renderChapter,
}) {
  const partIdSet = new Set(parts.map(p => p.id));
  const ungroupedChapters = chapters.filter(c => !partIdSet.has(c.partId));
  if (parts.length === 0 && ungroupedChapters.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📚</div>
        <p className="empty-state-text">No parts yet. Add parts, then add chapters inside each part.</p>
      </div>
    );
  }
  return (
    <div className="part-list">
      {parts.map((part, pIdx) => {
        const partChapters = chapters.filter(c => c.partId === part.id);
        const isCollapsed = !!collapsedParts[part.id];
        const isDragOver = dragOverPartId === part.id;
        return (
          <div
            key={part.id}
            className={`part-item${isCollapsed ? ' part-item--collapsed' : ''}${isDragOver ? ' part-item--drag-over' : ''}`}
            {...dropTarget(part.id, part.id)}
          >
            <div className="part-header">
              <button
                type="button"
                className="part-header-left part-toggle"
                onClick={() => onTogglePart(part.id)}
                aria-expanded={!isCollapsed}
                title={isCollapsed ? 'Expand part' : 'Collapse part'}
              >
                <span className={`part-chevron${isCollapsed ? ' part-chevron--collapsed' : ''}`}>▾</span>
                <span className="part-number">Part {part.orderIndex || pIdx + 1}</span>
                <div>
                  <div className="part-title">{part.title}</div>
                  {part.summary && <div className="chapter-summary"><ReactMarkdown>{part.summary}</ReactMarkdown></div>}
                  <div className="part-chapter-count">{partChapters.length} {partChapters.length === 1 ? 'chapter' : 'chapters'}</div>
                </div>
              </button>
              <div className="chapter-actions">
                <button
                  className="btn-icon"
                  title="Add chapter to this part"
                  onClick={() => onAddChapter(part.id)}
                >➕</button>
                <button
                  className="btn-icon"
                  title="Edit part"
                  onClick={() => onEditPart(part)}
                >✏️</button>
                <button
                  className="btn-icon"
                  title="Delete part"
                  onClick={() => onDeletePart(part)}
                >🗑️</button>
              </div>
            </div>
            {!isCollapsed && (
              partChapters.length === 0 ? (
                <div className="empty-state" style={{ padding: '1rem' }}>
                  <p className="empty-state-text" style={{ fontSize: '0.85rem' }}>No chapters in this part yet.</p>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onAddChapter(part.id)}
                  >
                    + Add Chapter
                  </button>
                </div>
              ) : (
                <div className="chapter-list">
                  {partChapters.map((chapter, idx) => renderChapter(chapter, idx))}
                </div>
              )
            )}
          </div>
        );
      })}
      {ungroupedChapters.length > 0 && (
        <div
          className={`part-item part-item--ungrouped${dragOverPartId === 'ungrouped' ? ' part-item--drag-over' : ''}`}
          {...dropTarget('ungrouped', null)}
        >
          <div className="part-header">
            <div className="part-header-left">
              <span className="part-number part-number--ungrouped">Ungrouped</span>
              <div>
                <div className="part-title">Unassigned chapters</div>
                <div className="part-chapter-count">{ungroupedChapters.length} {ungroupedChapters.length === 1 ? 'chapter' : 'chapters'} · drag each into a part above</div>
              </div>
            </div>
            <div className="chapter-actions">
              <button
                className="btn-icon"
                title="Add an ungrouped chapter"
                onClick={() => onAddChapter(null)}
              >➕</button>
            </div>
          </div>
          <div className="chapter-list">
            {ungroupedChapters.map((chapter, idx) => renderChapter(chapter, idx))}
          </div>
        </div>
      )}
    </div>
  );
}
