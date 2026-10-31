import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { bookApi, chapterApi, partApi, ideaApi, excerptApi, explanationApi } from '../api';
import { useRefresh } from '../queries';
import ChapterForm from '../components/ChapterForm';
import PartForm from '../components/PartForm';
import IdeaForm from '../components/IdeaForm';
import ExcerptForm from '../components/ExcerptForm';
import ExcerptReader from '../components/ExcerptReader';
import ChapterImageViewer from '../components/ChapterImageViewer';
import ConfirmDialog from '../components/ConfirmDialog';
import ChapterExplanationModal from '../components/ChapterExplanationModal';
import ExplanationMarksPanel from '../components/ExplanationMarksPanel';
import ExplanationExportModal from '../components/ExplanationExportModal';
import BookHeader from './bookDetail/BookHeader';
import ChapterCard from './bookDetail/ChapterCard';
import PartList from './bookDetail/PartList';
import { BookImportModal, ChapterImportModal } from './bookDetail/ImportModals';
import { explanationExportChapters } from './bookDetail/explanationExport';
import { useBookDetailData } from './bookDetail/useBookDetailData';
import { useChapterDrag } from './bookDetail/useChapterDrag';
import { useExplanationReader } from './bookDetail/useExplanationReader';

// The book page: header, the book's parts / chapters / ideas, and every dialog
// opened from them. The page owns which dialog is open and the writes; the
// pieces live in ./bookDetail.
export default function BookDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const refresh = useRefresh();
  const fromCollections = location.state?.from === 'collections';
  const backTo = fromCollections ? '/collections' : '/';
  const backState = fromCollections
    ? { collectionId: location.state?.collectionId ?? null, includeDescendants: location.state?.includeDescendants ?? false }
    : undefined;
  const backLabel = fromCollections ? '← Back to Collection' : '← Back to Library';

  const {
    isPending, book, chapters, parts, marks, latestBookmark, bookmarkedChapterIds, chapterById,
    updateDetail, updateChapter,
  } = useBookDetailData(id);

  const [collapsedParts, setCollapsedParts] = useState({});
  const [expandedChapters, setExpandedChapters] = useState({});
  const [scrollToChapter, setScrollToChapter] = useState(null);
  const chapterRefs = useRef({});

  // Form states
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [editChapter, setEditChapter] = useState(null);
  const [addChapterPartId, setAddChapterPartId] = useState(null); // part to add the new chapter to
  const [showPartForm, setShowPartForm] = useState(false);
  const [editPart, setEditPart] = useState(null);
  const [showIdeaForm, setShowIdeaForm] = useState(null); // chapterId
  const [editIdea, setEditIdea] = useState(null);
  const [showExcerptForm, setShowExcerptForm] = useState(null); // chapterId
  const [editExcerpt, setEditExcerpt] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type, id, chapterId?, name }
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [showChapterImport, setShowChapterImport] = useState(null); // chapterId
  const [excerptReader, setExcerptReader] = useState(null); // { chapterId, startIndex }
  const [imageViewer, setImageViewer] = useState(null); // chapterId
  const [showMarks, setShowMarks] = useState(false);
  const [showExplanationExport, setShowExplanationExport] = useState(false);

  const reader = useExplanationReader({
    updateDetail,
    updateChapter,
    refresh,
    deepLink: location.state?.openExplanation,
    bookLoaded: book != null,
  });

  // Move a chapter to another part (targetPartId = null → "Ungrouped"). Only the
  // chapter's part_id changes, so its ideas/excerpts/explanation stay attached.
  const handleChapterReassign = async (chapterId, targetPartId) => {
    if (chapterId == null) return;
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter) return;
    const currentPartId = chapter.partId ?? null;
    const newPartId = targetPartId ?? null;
    if (currentPartId === newPartId) return;
    updateChapter(chapterId, c => ({ ...c, partId: newPartId }));
    try {
      await chapterApi.update(id, chapterId, {
        title: chapter.title,
        orderIndex: chapter.orderIndex,
        summary: chapter.summary,
        partId: newPartId,
      });
    } catch {
      updateChapter(chapterId, c => ({ ...c, partId: currentPartId }));
    }
    refresh();
  };
  const drag = useChapterDrag(handleChapterReassign);

  const handleStatusChange = async (status) => {
    const newStatus = status || null;
    updateDetail(d => ({ ...d, book: { ...d.book, readingStatus: newStatus } }));
    try {
      await bookApi.update(book.id, { ...book, readingStatus: newStatus });
    } catch { /* refresh() puts the stored status back */ }
    refresh();
  };

  const handleExport = async () => {
    try {
      const data = await bookApi.export(id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${book?.title || 'book'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (scrollToChapter && chapterRefs.current[scrollToChapter]) {
      chapterRefs.current[scrollToChapter].scrollIntoView({ behavior: 'smooth', block: 'start' });
      setScrollToChapter(null);
    }
  }, [scrollToChapter, expandedChapters]);

  // Ideas and excerpts come with the chapters, so expanding needs no request.
  const toggleChapter = (chapterId) => {
    const isExpanded = expandedChapters[chapterId];
    setExpandedChapters(isExpanded ? {} : { [chapterId]: true });
    if (!isExpanded) setScrollToChapter(chapterId);
  };

  const jumpToMark = (mark) => {
    setShowMarks(false);
    reader.open(mark.chapterId, false, null, mark);
  };

  // Jump straight to the most recently bookmarked chapter and scroll position.
  const continueReading = () => {
    if (!latestBookmark) return;
    reader.open(latestBookmark.chapterId, false, latestBookmark.scrollRatio ?? 0);
  };

  // Chapter CRUD
  const openChapterForm = (chapter, partId = null) => {
    setEditChapter(chapter);
    setAddChapterPartId(partId);
    setShowChapterForm(true);
  };

  const handleSaveChapter = async (form) => {
    if (editChapter) {
      await chapterApi.update(id, editChapter.id, { ...form, partId: editChapter.partId ?? null });
    } else {
      await chapterApi.create(id, { ...form, partId: addChapterPartId ?? null });
    }
    setShowChapterForm(false);
    setEditChapter(null);
    setAddChapterPartId(null);
    refresh();
  };

  // Part CRUD
  const handleSavePart = async (form) => {
    if (editPart) {
      await partApi.update(id, editPart.id, form);
    } else {
      await partApi.create(id, form);
    }
    setShowPartForm(false);
    setEditPart(null);
    refresh();
  };

  // Idea CRUD
  const handleSaveIdea = async (form) => {
    const chapterId = editIdea ? editIdea.chapterId : showIdeaForm;
    if (editIdea) {
      await ideaApi.update(chapterId, editIdea.id, form);
    } else {
      await ideaApi.create(chapterId, form);
    }
    setShowIdeaForm(null);
    setEditIdea(null);
    refresh();
  };

  const handleToggleHighlight = async (idea, chapterId) => {
    await ideaApi.update(chapterId, idea.id, { ...idea, highlighted: !idea.highlighted });
    refresh();
  };

  const handleToggleExcerptHighlight = async (excerpt) => {
    await excerptApi.update(excerpt.chapterId || excerptReader?.chapterId, excerpt.id, { ...excerpt, highlighted: !excerpt.highlighted });
    refresh();
  };

  // Excerpt CRUD
  const handleSaveExcerpt = async (form) => {
    const chapterId = editExcerpt ? editExcerpt.chapterId : showExcerptForm;
    if (editExcerpt) {
      await excerptApi.update(chapterId, editExcerpt.id, form);
    } else {
      await excerptApi.create(chapterId, form);
    }
    setShowExcerptForm(null);
    setEditExcerpt(null);
    refresh();
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'chapter') {
      await chapterApi.delete(id, deleteTarget.id);
    } else if (deleteTarget.type === 'part') {
      await partApi.delete(id, deleteTarget.id);
    } else if (deleteTarget.type === 'idea') {
      await ideaApi.delete(deleteTarget.chapterId, deleteTarget.id);
    } else if (deleteTarget.type === 'excerpt') {
      await excerptApi.delete(deleteTarget.chapterId, deleteTarget.id);
      const remaining = (chapterById(deleteTarget.chapterId)?.excerpts ?? []).filter(e => e.id !== deleteTarget.id);
      updateChapter(deleteTarget.chapterId, c => ({ ...c, excerpts: remaining }));
      if (remaining.length > 0) {
        const newIndex = Math.min(deleteTarget.readerIndex ?? 0, remaining.length - 1);
        setExcerptReader({ chapterId: deleteTarget.chapterId, startIndex: newIndex });
      }
    }
    setDeleteTarget(null);
    refresh();
  };

  if (isPending) return <div className="loading">Loading book</div>;
  if (!book) return <div className="empty-state"><p>Book not found</p></div>;

  const isParts = book.structureType === 'PARTS';

  const togglePart = (partId) => {
    setCollapsedParts(prev => ({ ...prev, [partId]: !prev[partId] }));
  };

  // What a chapter row can do (see ChapterCard).
  const chapterActions = {
    toggleChapter,
    importIntoChapter: (chapterId) => setShowChapterImport(chapterId),
    openImages: (chapterId) => setImageViewer(chapterId),
    readExcerpts: (chapterId) => setExcerptReader({ chapterId, startIndex: 0 }),
    openExplanation: reader.open,
    editChapter: (chapter) => { setEditChapter(chapter); setShowChapterForm(true); },
    deleteChapter: (chapter) => setDeleteTarget({ type: 'chapter', id: chapter.id, name: chapter.title }),
    addIdea: (chapterId) => setShowIdeaForm(chapterId),
    toggleIdeaHighlight: handleToggleHighlight,
    editIdea: (idea, chapterId) => setEditIdea({ ...idea, chapterId }),
    deleteIdea: (idea, chapterId) => setDeleteTarget({
      type: 'idea',
      id: idea.id,
      chapterId,
      name: idea.content.substring(0, 50),
    }),
  };

  const renderChapter = (chapter, idx) => (
    <ChapterCard
      key={chapter.id}
      chapter={chapter}
      idx={idx}
      isParts={isParts}
      imagesEnabled={book.chapterImagesEnabled}
      expanded={!!expandedChapters[chapter.id]}
      hasBookmark={!!bookmarkedChapterIds[chapter.id]}
      latestBookmark={latestBookmark}
      dragHandle={drag.dragHandle(chapter.id)}
      cardRef={el => chapterRefs.current[chapter.id] = el}
      actions={chapterActions}
    />
  );

  const readerChapterId = excerptReader?.chapterId;
  const readerExcerpts = readerChapterId != null ? chapterById(readerChapterId)?.excerpts : undefined;

  return (
    <div>
      <Link to={backTo} state={backState} className="back-link">{backLabel}</Link>

      <BookHeader
        book={book}
        latestBookmark={latestBookmark}
        markCount={marks.length}
        onStatusChange={handleStatusChange}
        onContinueReading={continueReading}
        onExportJson={handleExport}
        onExportExplanations={() => setShowExplanationExport(true)}
        onShowMarks={() => setShowMarks(true)}
      />

      <div className="section-header">
        <h2 className="section-title">{isParts ? 'Parts' : 'Chapters'}</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowJsonImport(true)}
          >
            Import JSON
          </button>
          {isParts ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setEditPart(null); setShowPartForm(true); }}
            >
              + Add Part
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => openChapterForm(null)}
            >
              + Add Chapter
            </button>
          )}
        </div>
      </div>

      {isParts ? (
        <PartList
          parts={parts}
          chapters={chapters}
          collapsedParts={collapsedParts}
          onTogglePart={togglePart}
          dragOverPartId={drag.dragOverPartId}
          dropTarget={drag.dropTarget}
          onAddChapter={(partId) => openChapterForm(null, partId)}
          onEditPart={(part) => { setEditPart(part); setShowPartForm(true); }}
          onDeletePart={(part) => setDeleteTarget({ type: 'part', id: part.id, name: part.title })}
          renderChapter={renderChapter}
        />
      ) : (
        chapters.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📑</div>
            <p className="empty-state-text">No chapters yet. Add the book's structure to start logging ideas.</p>
          </div>
        ) : (
          <div className="chapter-list">
            {chapters.map((chapter, idx) => renderChapter(chapter, idx))}
          </div>
        )
      )}

      {showJsonImport && (
        <BookImportModal bookId={id} isParts={isParts} onClose={() => setShowJsonImport(false)} />
      )}

      {showChapterImport && (
        <ChapterImportModal
          bookId={id}
          chapterId={showChapterImport}
          chapterTitle={chapterById(showChapterImport)?.title}
          onClose={() => setShowChapterImport(null)}
        />
      )}

      {(showExcerptForm || editExcerpt) && (
        <ExcerptForm
          key={editExcerpt?.id ?? 'new'}
          excerpt={editExcerpt}
          onSave={handleSaveExcerpt}
          onClose={() => { setShowExcerptForm(null); setEditExcerpt(null); }}
        />
      )}

      {excerptReader && readerExcerpts && (
        <ExcerptReader
          excerpts={readerExcerpts}
          startIndex={excerptReader.startIndex}
          chapterTitle={chapterById(readerChapterId)?.title || ''}
          onClose={() => setExcerptReader(null)}
          onToggleHighlight={handleToggleExcerptHighlight}
          onEdit={(ex) => {
            setExcerptReader(null);
            setEditExcerpt({ ...ex, chapterId: readerChapterId });
          }}
          onDelete={(ex) => {
            const currentIdx = readerExcerpts.findIndex(e => e.id === ex.id);
            setExcerptReader(null);
            setDeleteTarget({
              type: 'excerpt',
              id: ex.id,
              chapterId: readerChapterId,
              name: ex.content.substring(0, 50),
              readerIndex: Math.max(0, currentIdx),
            });
          }}
        />
      )}

      {imageViewer && (
        <ChapterImageViewer
          chapterId={imageViewer}
          chapterTitle={chapterById(imageViewer)?.title || ''}
          onClose={() => setImageViewer(null)}
        />
      )}

      {showChapterForm && (
        <ChapterForm
          key={editChapter?.id ?? 'new'}
          chapter={editChapter}
          onSave={handleSaveChapter}
          onClose={() => { setShowChapterForm(false); setEditChapter(null); setAddChapterPartId(null); }}
        />
      )}

      {showPartForm && (
        <PartForm
          key={editPart?.id ?? 'new'}
          part={editPart}
          onSave={handleSavePart}
          onClose={() => { setShowPartForm(false); setEditPart(null); }}
        />
      )}

      {(showIdeaForm || editIdea) && (
        <IdeaForm
          key={editIdea?.id ?? 'new'}
          idea={editIdea}
          onSave={handleSaveIdea}
          onClose={() => { setShowIdeaForm(null); setEditIdea(null); }}
        />
      )}

      {reader.modal && (
        <ChapterExplanationModal
          chapterTitle={chapterById(reader.modal.chapterId)?.title || 'Chapter'}
          bookTitle={book.title}
          explanation={reader.modal.data}
          startInEdit={reader.modal.startInEdit}
          initialScrollRatio={reader.modal.initialScrollRatio}
          initialAnchor={reader.modal.initialAnchor}
          saving={reader.saving}
          bookmarking={reader.bookmarking}
          onClose={reader.close}
          onSave={reader.save}
          onDelete={reader.remove}
          onBookmark={reader.bookmark}
          onSaveMark={reader.saveMark}
          onDeleteMark={reader.deleteMark}
          marks={marks.filter(m => m.chapterId === reader.modal.chapterId)}
          onAnchorResult={reader.onAnchorResult}
        />
      )}

      {showMarks && (
        <ExplanationMarksPanel
          marks={marks}
          staleIds={reader.staleMarkIds}
          onJump={jumpToMark}
          onUpdateNote={reader.updateMarkNote}
          onDelete={reader.deleteMark}
          onClose={() => setShowMarks(false)}
        />
      )}

      {showExplanationExport && (
        <ExplanationExportModal
          chapters={explanationExportChapters(chapters, parts, isParts)}
          totalChapters={chapters.length}
          bookTitle={book.title}
          fetchContent={(chapterId) => explanationApi.get(chapterId)}
          onClose={() => setShowExplanationExport(false)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Delete ${deleteTarget.type} "${deleteTarget.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
