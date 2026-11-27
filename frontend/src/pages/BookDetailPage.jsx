import { lazy, Suspense, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { bookApi, chapterApi, partApi, explanationApi, favoriteApi } from '../api';
import { useRefresh } from '../queries';
import ChapterForm from '../components/ChapterForm';
import PartForm from '../components/PartForm';
import ChapterImageViewer from '../components/ChapterImageViewer';
import ConfirmDialog from '../components/ConfirmDialog';
import ChapterExplanationModal from '../components/ChapterExplanationModal';
import ExplanationMarksPanel from '../components/ExplanationMarksPanel';
import LoadError from '../components/feedback/LoadError';
import { attempt, reportError } from '../components/feedback/toast';
import NotFoundPage from './NotFoundPage';
import BookHeader from './bookDetail/BookHeader';
import ChapterCard from './bookDetail/ChapterCard';
import PartList from './bookDetail/PartList';
import { BookImportModal } from './bookDetail/ImportModals';
import { explanationExportChapters } from './bookDetail/explanationExport';
import { useBookDetailData } from './bookDetail/useBookDetailData';
import { useChapterDrag } from './bookDetail/useChapterDrag';
import { applyChapterPlacements, planChapterMove } from './bookDetail/chapterOrder';
import { useExplanationReader } from './bookDetail/useExplanationReader';

// Bundles jszip; loaded when "Export Explanations" is first opened (FE-04).
const ExplanationExportModal = lazy(() => import('../components/ExplanationExportModal'));

// The book page: header, the book's parts / chapters, and every dialog
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
    isPending, error, refetch, book, chapters, parts, marks, latestBookmark, bookmarkedChapterIds, chapterById,
    updateDetail, updateChapter,
  } = useBookDetailData(id);

  const [collapsedParts, setCollapsedParts] = useState({});

  // Form states
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [editChapter, setEditChapter] = useState(null);
  const [addChapterPartId, setAddChapterPartId] = useState(null); // part to add the new chapter to
  const [showPartForm, setShowPartForm] = useState(false);
  const [editPart, setEditPart] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type, id, name }
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [imageViewer, setImageViewer] = useState(null); // chapterId
  const [showMarks, setShowMarks] = useState(false);
  const [marksChapterId, setMarksChapterId] = useState(null); // chapter last viewed in Saved Passages
  const [showExplanationExport, setShowExplanationExport] = useState(false);

  const reader = useExplanationReader({
    updateDetail,
    updateChapter,
    refresh,
    deepLink: location.state?.openExplanation,
    bookLoaded: book != null,
    marks,
  });

  // Move a chapter to another position, in its list or in another part
  // (targetPartId = null → "Ungrouped" / a plain book), in front of
  // beforeChapterId (null → at the end). The moved chapter keeps its
  // explanation; the chapters of the lists involved are renumbered in one
  // request (see chapterOrder.js).
  const handleChapterMove = async (chapterId, targetPartId, beforeChapterId) => {
    const placements = planChapterMove(chapters, parts, chapterId, targetPartId, beforeChapterId);
    if (!placements) return;
    const previous = chapters;
    updateDetail(d => ({ ...d, chapters: applyChapterPlacements(d.chapters, placements) }));
    try {
      await chapterApi.reorder(id, placements);
    } catch (err) {
      updateDetail(d => ({ ...d, chapters: previous }));
      reportError('Could not move the chapter', err);
    }
    refresh();
  };
  const drag = useChapterDrag(handleChapterMove);

  const handleStatusChange = async (status) => {
    const newStatus = status || null;
    updateDetail(d => ({ ...d, book: { ...d.book, readingStatus: newStatus } }));
    try {
      await bookApi.update(book.id, { ...book, readingStatus: newStatus });
    } catch (err) {
      reportError('Could not change the reading status', err); // refresh() puts the stored status back
    }
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
    } catch (err) {
      reportError('Could not export the book', err);
    }
  };

  const jumpToMark = (mark) => {
    setShowMarks(false);
    reader.open(mark.chapterId, false, null, mark);
  };

  // Open the chapter to pick new text for an orphaned passage.
  const relinkMark = (mark) => {
    setShowMarks(false);
    reader.open(mark.chapterId, false, null, null, mark);
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
    const saved = await attempt('Could not save the chapter', () => (editChapter
      ? chapterApi.update(id, editChapter.id, { ...form, partId: editChapter.partId ?? null })
      : chapterApi.create(id, { ...form, partId: addChapterPartId ?? null })));
    if (!saved) return;
    setShowChapterForm(false);
    setEditChapter(null);
    setAddChapterPartId(null);
    refresh();
  };

  // Part CRUD
  const handleSavePart = async (form) => {
    const saved = await attempt('Could not save the part', () => (editPart
      ? partApi.update(id, editPart.id, form)
      : partApi.create(id, form)));
    if (!saved) return;
    setShowPartForm(false);
    setEditPart(null);
    refresh();
  };

  // Star / unstar a chapter for Favorite Chapters; the star changes at once and is
  // put back if the request fails.
  const handleToggleFavorite = async (chapterId) => {
    const favorite = !chapterById(chapterId)?.favorite;
    updateChapter(chapterId, c => ({ ...c, favorite }));
    try {
      await (favorite ? favoriteApi.add(chapterId) : favoriteApi.remove(chapterId));
    } catch (err) {
      updateChapter(chapterId, c => ({ ...c, favorite: !favorite }));
      reportError(favorite ? 'Could not add the chapter to favorites' : 'Could not remove the chapter from favorites', err);
    }
    refresh();
  };

  // Delete
  const deleteRequest = (target) => {
    switch (target.type) {
      case 'chapter': return chapterApi.delete(id, target.id);
      case 'part': return partApi.delete(id, target.id);
      default: return Promise.resolve();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const deleted = await attempt(`Could not delete the ${deleteTarget.type}`, () => deleteRequest(deleteTarget));
    if (!deleted) return;
    setDeleteTarget(null);
    refresh();
  };

  if (isPending) return <div className="loading">Loading book</div>;
  if (error?.status === 404) {
    return <NotFoundPage title="Book not found" message="This book does not exist. It may have been deleted." />;
  }
  if (!book) {
    return (
      <div>
        <Link to={backTo} state={backState} className="back-link">{backLabel}</Link>
        <LoadError what="the book" error={error} onRetry={refetch} />
      </div>
    );
  }

  const isParts = book.structureType === 'PARTS';

  const togglePart = (partId) => {
    setCollapsedParts(prev => ({ ...prev, [partId]: !prev[partId] }));
  };

  // What a chapter row can do (see ChapterCard).
  const chapterActions = {
    openImages: (chapterId) => setImageViewer(chapterId),
    openExplanation: reader.open,
    toggleFavorite: (chapter) => handleToggleFavorite(chapter.id),
    editChapter: (chapter) => { setEditChapter(chapter); setShowChapterForm(true); },
    deleteChapter: (chapter) => setDeleteTarget({ type: 'chapter', id: chapter.id, name: chapter.title }),
  };

  const renderChapter = (chapter, idx) => (
    <ChapterCard
      key={chapter.id}
      chapter={chapter}
      idx={idx}
      imagesEnabled={book.chapterImagesEnabled}
      hasBookmark={!!bookmarkedChapterIds[chapter.id]}
      latestBookmark={latestBookmark}
      dragHandle={drag.dragHandle(chapter.id)}
      dragging={drag.draggedChapterId === chapter.id}
      dropIndicator={drag.dropIndicator(chapter.id)}
      actions={chapterActions}
    />
  );

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
            <p className="empty-state-text">No chapters yet. Add the book's structure to get started.</p>
          </div>
        ) : (
          <div className="chapter-list" {...drag.dropTarget('chapters', null)}>
            {chapters.map((chapter, idx) => renderChapter(chapter, idx))}
          </div>
        )
      )}

      {showJsonImport && (
        <BookImportModal bookId={id} isParts={isParts} onClose={() => setShowJsonImport(false)} />
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

      {reader.modal && (
        <ChapterExplanationModal
          chapterId={reader.modal.chapterId}
          imageCount={chapterById(reader.modal.chapterId)?.imageCount ?? 0}
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
          onUpdateMarkNote={reader.updateMarkNote}
          marks={marks.filter(m => m.chapterId === reader.modal.chapterId)}
          favorite={!!chapterById(reader.modal.chapterId)?.favorite}
          onToggleFavorite={() => handleToggleFavorite(reader.modal.chapterId)}
          relinkMark={reader.modal.relinkMark}
          onRelinkMark={reader.relinkMark}
          onCancelRelink={reader.cancelRelink}
          onAnchorResult={reader.onAnchorResult}
        />
      )}

      {showMarks && (
        <ExplanationMarksPanel
          marks={marks}
          chapters={chapters}
          parts={parts}
          isParts={isParts}
          initialChapterId={marksChapterId}
          onChapterChange={setMarksChapterId}
          onJump={jumpToMark}
          onRelink={relinkMark}
          onUpdateNote={reader.updateMarkNote}
          onDelete={reader.deleteMark}
          onClose={() => setShowMarks(false)}
        />
      )}

      {showExplanationExport && (
        <Suspense fallback={null}>
          <ExplanationExportModal
            chapters={explanationExportChapters(chapters, parts, isParts)}
            totalChapters={chapters.length}
            bookTitle={book.title}
            fetchContent={(chapterId) => explanationApi.get(chapterId)}
            onClose={() => setShowExplanationExport(false)}
          />
        </Suspense>
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
