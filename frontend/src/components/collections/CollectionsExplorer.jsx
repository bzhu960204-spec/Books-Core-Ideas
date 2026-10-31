import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { bookCollectionApi } from '../../api';
import { queryKeys, useCollectionBooks, useCollections, useRefresh } from '../../queries';
import CollectionTree, { BOOK_DND_TYPE, BOOK_SOURCE_DND_TYPE } from './CollectionTree';
import { buildFolderTree } from './folderTree';
import PickBooksModal from './PickBooksModal';
import ConfirmDialog from '../ConfirmDialog';
import LoadError from '../feedback/LoadError';
import { attempt, reportError } from '../feedback/toast';

const NONE = [];

export default function CollectionsExplorer() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const refresh = useRefresh();
  const [selectedId, setSelectedId] = useState(() => location.state?.collectionId ?? null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [includeDescendants, setIncludeDescendants] = useState(() => location.state?.includeDescendants ?? false);
  const collectionsQuery = useCollections();
  const collections = collectionsQuery.data ?? NONE;
  const loadingTree = collectionsQuery.isPending;
  const booksQuery = useCollectionBooks(selectedId, includeDescendants);
  const books = (selectedId != null && booksQuery.data) || NONE;
  const loadingBooks = selectedId != null && booksQuery.isPending;
  const [dialog, setDialog] = useState(null); // { mode, parentId, targetId, value }
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [brokenCovers, setBrokenCovers] = useState(() => new Set());
  const [crumbMenuOpen, setCrumbMenuOpen] = useState(false);
  const navigate = useNavigate();

  const roots = useMemo(() => buildFolderTree(collections), [collections]);
  const byId = useMemo(() => new Map(collections.map(c => [c.id, c])), [collections]);
  const selected = selectedId != null ? byId.get(selectedId) ?? null : null;

  const markCoverBroken = (id) => setBrokenCovers(prev => {
    if (prev.has(id)) return prev;
    const next = new Set(prev);
    next.add(id);
    return next;
  });

  const breadcrumb = useMemo(() => {
    const path = [];
    let cur = selected;
    const guard = new Set();
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id);
      path.unshift(cur);
      cur = cur.parentId != null ? byId.get(cur.parentId) ?? null : null;
    }
    return path;
  }, [selected, byId]);

  // Collapse deep breadcrumbs: keep root + last two levels, hide the middle behind a "…" menu.
  const COLLAPSE_AFTER = 4;
  const { visibleCrumbs, hiddenCrumbs } = useMemo(() => {
    if (breadcrumb.length <= COLLAPSE_AFTER) {
      return { visibleCrumbs: breadcrumb.map(c => ({ type: 'crumb', crumb: c })), hiddenCrumbs: [] };
    }
    const head = breadcrumb[0];
    const tail = breadcrumb.slice(-2);
    const middle = breadcrumb.slice(1, -2);
    return {
      visibleCrumbs: [
        { type: 'crumb', crumb: head },
        { type: 'ellipsis' },
        ...tail.map(c => ({ type: 'crumb', crumb: c })),
      ],
      hiddenCrumbs: middle,
    };
  }, [breadcrumb]);

  // Close the breadcrumb overflow menu whenever the selected folder changes.
  const [crumbMenuFor, setCrumbMenuFor] = useState(selectedId);
  if (crumbMenuFor !== selectedId) {
    setCrumbMenuFor(selectedId);
    setCrumbMenuOpen(false);
  }

  const toggleExpand = (id) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // ---- folder mutations -----------------------------------------------------

  const submitDialog = async () => {
    if (!dialog) return;
    const name = dialog.value.trim();
    if (!name) return;
    const rename = dialog.mode === 'rename' && dialog.targetId != null;
    try {
      if (rename) {
        await bookCollectionApi.rename(dialog.targetId, name);
      } else {
        const created = await bookCollectionApi.create(name, dialog.parentId);
        if (dialog.parentId != null) {
          setExpanded(prev => new Set(prev).add(dialog.parentId));
        }
        setSelectedId(created.id);
      }
      setDialog(null);
      await refresh();
    } catch (err) {
      reportError(rename ? 'Could not rename the collection' : 'Could not create the collection', err);
    }
  };

  const deleteFolder = async () => {
    const folder = confirmDeleteFolder;
    if (!await attempt('Could not delete the collection', () => bookCollectionApi.remove(folder.id))) return;
    setConfirmDeleteFolder(null);
    if (selectedId === folder.id) setSelectedId(null);
    await refresh();
  };

  const dropBookIntoFolder = async (bookId, folderId, sourceFolderId) => {
    if (sourceFolderId === folderId) return; // dropped back onto its own folder
    try {
      await bookCollectionApi.addBook(folderId, bookId);
      // Move semantics: remove from the folder it was dragged out of.
      if (sourceFolderId != null && sourceFolderId !== folderId) {
        await bookCollectionApi.removeBook(sourceFolderId, bookId);
      }
    } catch (err) {
      reportError('Could not move the book to the collection', err);
    }
    await refresh(); // also after a failure: a move may have half happened
  };

  const removeBookFromFolder = async (bookId) => {
    if (selectedId == null) return;
    try {
      await bookCollectionApi.removeBook(selectedId, bookId);
      queryClient.setQueryData(queryKeys.collectionBooks(selectedId, includeDescendants),
        list => list?.filter(b => b.id !== bookId));
      refresh();
    } catch (err) {
      reportError('Could not remove the book from the collection', err);
    }
  };

  const dropFolderIntoFolder = async (draggedId, targetId) => {
    if (draggedId === targetId) return;
    try {
      await bookCollectionApi.move(draggedId, targetId);
      if (targetId != null) setExpanded(prev => new Set(prev).add(targetId));
      await refresh();
    } catch (err) {
      reportError('Could not move the collection', err);
    }
  };

  // ---- render ---------------------------------------------------------------

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Collections</h1>
          <div className="page-ornament" />
        </div>
      </div>

      <div className="coll-page">
        <aside className="coll-sidebar">
          <div className="coll-sidebar-header">
            <h3>Folders</h3>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setDialog({ mode: 'create-root', parentId: null, targetId: null, value: '' })}
            >
              ＋ New
            </button>
          </div>
          {loadingTree ? (
            <p className="coll-tree-empty">Loading…</p>
          ) : collectionsQuery.error && !collectionsQuery.data ? (
            <LoadError what="the collections" error={collectionsQuery.error} onRetry={collectionsQuery.refetch} />
          ) : (
            <CollectionTree
              roots={roots}
              selectedId={selectedId}
              expanded={expanded}
              onSelect={setSelectedId}
              onToggleExpand={toggleExpand}
              onAddChild={parentId => setDialog({ mode: 'create-child', parentId, targetId: null, value: '' })}
              onRename={folder => setDialog({ mode: 'rename', parentId: null, targetId: folder.id, value: folder.name })}
              onDelete={setConfirmDeleteFolder}
              onDropBook={dropBookIntoFolder}
              onDropFolder={dropFolderIntoFolder}
            />
          )}
        </aside>

        <section className="coll-content">
          {selected == null ? (
            <div className="empty-state">
              <div className="empty-state-icon">🗂️</div>
              <p className="empty-state-text">Select a collection on the left to view its books, or create a new one.</p>
              <p className="empty-state-hint">Tip: drag a book card onto a folder to file it away.</p>
            </div>
          ) : (
            <>
              <div className="coll-content-header">
                <nav className="coll-breadcrumb">
                  {visibleCrumbs.map((item, i) => (
                    <span key={item.type === 'ellipsis' ? '__ellipsis__' : item.crumb.id} className="coll-breadcrumb-crumb">
                      {i > 0 && <span className="coll-breadcrumb-sep">/</span>}
                      {item.type === 'ellipsis' ? (
                        <span className="coll-breadcrumb-collapse">
                          <button
                            type="button"
                            className="coll-breadcrumb-item coll-breadcrumb-ellipsis"
                            onClick={() => setCrumbMenuOpen(o => !o)}
                            aria-haspopup="true"
                            aria-expanded={crumbMenuOpen}
                            title="Show hidden folders"
                          >
                            …
                          </button>
                          {crumbMenuOpen && (
                            <>
                              <div className="coll-crumb-menu-backdrop" onClick={() => setCrumbMenuOpen(false)} />
                              <div className="coll-crumb-menu" role="menu">
                                {hiddenCrumbs.map(c => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    role="menuitem"
                                    className="coll-crumb-menu-item"
                                    onClick={() => { setSelectedId(c.id); setCrumbMenuOpen(false); }}
                                    title={c.name}
                                  >
                                    {c.name}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </span>
                      ) : (
                        <button className="coll-breadcrumb-item" onClick={() => setSelectedId(item.crumb.id)} title={item.crumb.name}>
                          {item.crumb.name}
                        </button>
                      )}
                    </span>
                  ))}
                </nav>
                <div className="coll-content-header-actions">
                  <label className="coll-include-toggle">
                    <input
                      type="checkbox"
                      checked={includeDescendants}
                      onChange={e => setIncludeDescendants(e.target.checked)}
                    />
                    Include books from sub-folders
                  </label>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowPicker(true)}>
                    ＋ Add books
                  </button>
                </div>
              </div>

              {loadingBooks ? (
                <p className="coll-tree-empty">Loading…</p>
              ) : booksQuery.error && !booksQuery.data ? (
                <LoadError what="the books of this collection" error={booksQuery.error} onRetry={booksQuery.refetch} />
              ) : books.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📥</div>
                  <p className="empty-state-text">This collection has no books yet.</p>
                  <p className="empty-state-hint">Click “Collect” on a book in your Library, or drag a book card onto this folder.</p>
                </div>
              ) : (
                <ul className="coll-book-list">
                  {books.map(b => {
                    const hasCover = b.coverUrl && !brokenCovers.has(b.id);
                    return (
                      <li
                        key={b.id}
                        className="coll-book-row"
                        draggable
                        onDragStart={e => {
                          e.dataTransfer.setData(BOOK_DND_TYPE, String(b.id));
                          // Carry the source folder so a drop onto another folder MOVES it.
                          // Only when viewing a single folder (not aggregated descendants).
                          if (!includeDescendants && selectedId != null) {
                            e.dataTransfer.setData(BOOK_SOURCE_DND_TYPE, String(selectedId));
                          }
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onClick={() => navigate(`/book/${b.id}`, { state: { from: 'collections', collectionId: selectedId, includeDescendants } })}
                      >
                        <div className="coll-book-thumb">
                          {hasCover ? (
                            <img src={b.coverUrl} alt="" onError={() => markCoverBroken(b.id)} />
                          ) : (
                            <span className="coll-book-thumb-fallback" aria-hidden="true">
                              {(b.title?.trim()?.[0] || '?').toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="coll-book-row-body">
                          <div className="coll-book-row-title">{b.title}</div>
                          <div className="coll-book-row-author">{b.author || 'Unknown author'}</div>
                          <div className="coll-book-row-meta">
                            {(b.rating ?? 0) > 0 && (
                              <span className="book-compact-rating">
                                {'★'.repeat(b.rating)}<span className="book-compact-rating-dim">{'★'.repeat(5 - b.rating)}</span>
                              </span>
                            )}
                            <span className="coll-book-row-chapters">{b.chapterCount ?? 0} chapters</span>
                          </div>
                        </div>
                        <button
                          className="btn-link danger coll-book-row-remove"
                          title="Remove from this collection (does not delete the book)"
                          onClick={e => { e.stopPropagation(); removeBookFromFolder(b.id); }}
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </section>
      </div>

      {dialog && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setDialog(null); }}>
          <div className="modal modal--sm">
            <button type="button" className="modal-close" onClick={() => setDialog(null)} aria-label="Close">×</button>
            <h3 className="modal-title">{dialog.mode === 'rename' ? 'Rename Collection' : 'New Collection'}</h3>
            <input
              autoFocus
              type="text"
              className="coll-name-input"
              placeholder="Collection name"
              value={dialog.value}
              onChange={e => setDialog({ ...dialog, value: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Enter') submitDialog();
                if (e.key === 'Escape') setDialog(null);
              }}
            />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDialog(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={!dialog.value.trim()} onClick={submitDialog}>
                {dialog.mode === 'rename' ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPicker && selectedId != null && (
        <PickBooksModal
          folderId={selectedId}
          existingIds={new Set(books.map(b => b.id))}
          onClose={() => setShowPicker(false)}
          onAdded={refresh}
        />
      )}

      {confirmDeleteFolder && (
        <ConfirmDialog
          message={`Delete collection “${confirmDeleteFolder.name}” and all its sub-folders? Books are not deleted, only un-filed.`}
          onConfirm={deleteFolder}
          onClose={() => setConfirmDeleteFolder(null)}
        />
      )}
    </div>
  );
}
