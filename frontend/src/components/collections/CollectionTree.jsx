import { useMemo, useState } from 'react';

/** dataTransfer type used when dragging a book card onto a folder to move it. */
export const BOOK_DND_TYPE = 'application/x-book-collection-book';

/** dataTransfer type carrying the folder a dragged book currently lives in (for move). */
export const BOOK_SOURCE_DND_TYPE = 'application/x-book-collection-book-source';

/** dataTransfer type used when dragging a folder onto another folder to reparent it. */
export const FOLDER_DND_TYPE = 'application/x-book-collection-folder';

/** Build a nested tree from the flat folder list (already sorted by sortOrder/name). */
export function buildFolderTree(folders) {
  const byId = new Map();
  folders.forEach(f => byId.set(f.id, { ...f, children: [] }));
  const roots = [];
  for (const node of byId.values()) {
    if (node.parentId != null && byId.has(node.parentId)) {
      byId.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function collectSubtreeIds(node, out) {
  out.add(node.id);
  node.children.forEach(child => collectSubtreeIds(child, out));
}

function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

export default function CollectionTree({
  roots,
  selectedId,
  expanded,
  onSelect,
  onToggleExpand,
  onAddChild,
  onRename,
  onDelete,
  onDropBook,
  onDropFolder,
}) {
  const [dropTarget, setDropTarget] = useState(null);
  const [draggedFolderId, setDraggedFolderId] = useState(null);
  const [rootDropActive, setRootDropActive] = useState(false);

  // A folder cannot be dropped onto itself or any of its own descendants.
  const blockedIds = useMemo(() => {
    const out = new Set();
    if (draggedFolderId != null) {
      const node = findNode(roots, draggedFolderId);
      if (node) collectSubtreeIds(node, out);
    }
    return out;
  }, [draggedFolderId, roots]);

  function clearDrag() {
    setDraggedFolderId(null);
    setDropTarget(null);
    setRootDropActive(false);
  }

  function dndProps(folderId) {
    return {
      dropActive: dropTarget === folderId,
      onDragStart: (e) => {
        e.dataTransfer.setData(FOLDER_DND_TYPE, String(folderId));
        e.dataTransfer.effectAllowed = 'move';
        setDraggedFolderId(folderId);
      },
      onDragEnd: () => clearDrag(),
      onDragOver: (e) => {
        const types = e.dataTransfer.types;
        if (types.includes(BOOK_DND_TYPE)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (dropTarget !== folderId) setDropTarget(folderId);
        } else if (types.includes(FOLDER_DND_TYPE)) {
          if (blockedIds.has(folderId)) return; // self or descendant → not allowed
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (dropTarget !== folderId) setDropTarget(folderId);
        }
      },
      onDragLeave: (e) => {
        const types = e.dataTransfer.types;
        if (!types.includes(BOOK_DND_TYPE) && !types.includes(FOLDER_DND_TYPE)) return;
        setDropTarget(prev => (prev === folderId ? null : prev));
      },
      onDrop: (e) => {
        const types = e.dataTransfer.types;
        if (types.includes(BOOK_DND_TYPE)) {
          e.preventDefault();
          const id = Number(e.dataTransfer.getData(BOOK_DND_TYPE));
          const rawSource = e.dataTransfer.getData(BOOK_SOURCE_DND_TYPE);
          const sourceFolderId = rawSource ? Number(rawSource) : null;
          setDropTarget(null);
          if (id) onDropBook(id, folderId, sourceFolderId);
        } else if (types.includes(FOLDER_DND_TYPE)) {
          if (blockedIds.has(folderId)) return;
          e.preventDefault();
          e.stopPropagation();
          const draggedId = Number(e.dataTransfer.getData(FOLDER_DND_TYPE));
          clearDrag();
          if (draggedId && draggedId !== folderId) onDropFolder(draggedId, folderId);
        }
      },
    };
  }

  // Only show the "move to root" zone while dragging a folder that isn't already
  // at the root, so it stays out of the way the rest of the time.
  const draggedNode = draggedFolderId != null ? findNode(roots, draggedFolderId) : null;
  const showRootDrop = draggedNode?.parentId != null;

  return (
    <div className="coll-tree">
      {roots.length === 0 && (
        <p className="coll-tree-empty">No collections yet. Click “New” above to create your first one.</p>
      )}
      {roots.map(node => (
        <FolderRow
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          expanded={expanded}
          onSelect={onSelect}
          onToggleExpand={onToggleExpand}
          onAddChild={onAddChild}
          onRename={onRename}
          onDelete={onDelete}
          dndProps={dndProps}
        />
      ))}
      {/*
        Rendered AFTER the rows on purpose. Inserting this drop zone above the
        list at dragstart shifts every row (including the drag source) downward,
        which makes the browser cancel the in-progress drag. Appending it keeps
        existing rows in place.
      */}
      {showRootDrop && (
        <div
          className={`coll-root-drop${rootDropActive ? ' coll-root-drop-active' : ''}`}
          onDragOver={e => {
            if (!e.dataTransfer.types.includes(FOLDER_DND_TYPE)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!rootDropActive) setRootDropActive(true);
          }}
          onDragLeave={() => setRootDropActive(false)}
          onDrop={e => {
            if (!e.dataTransfer.types.includes(FOLDER_DND_TYPE)) return;
            e.preventDefault();
            const draggedId = Number(e.dataTransfer.getData(FOLDER_DND_TYPE));
            clearDrag();
            if (draggedId) onDropFolder(draggedId, null);
          }}
        >
          ⤴ Move to top level
        </div>
      )}
    </div>
  );
}

function FolderRow({
  node,
  depth,
  selectedId,
  expanded,
  onSelect,
  onToggleExpand,
  onAddChild,
  onRename,
  onDelete,
  dndProps,
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  const active = selectedId === node.id;
  const dnd = dndProps(node.id);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        draggable
        onDragStart={dnd.onDragStart}
        onDragEnd={dnd.onDragEnd}
        onClick={() => onSelect(node.id)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(node.id);
          }
        }}
        onDragOver={dnd.onDragOver}
        onDragLeave={dnd.onDragLeave}
        onDrop={dnd.onDrop}
        style={{ paddingLeft: 6 + depth * 16 }}
        className={`coll-row${active ? ' coll-row-active' : ''}${dnd.dropActive ? ' coll-row-drop' : ''}`}
      >
        {hasChildren ? (
          <button
            type="button"
            className="coll-chevron"
            onClick={e => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            aria-label={isOpen ? 'Collapse' : 'Expand'}
          >
            {isOpen ? '▾' : '▸'}
          </button>
        ) : (
          <span className="coll-chevron coll-chevron-empty" />
        )}
        <span className="coll-folder-icon">{isOpen && hasChildren ? '📂' : '📁'}</span>
        <span className="coll-folder-name" title={node.name}>{node.name}</span>
        {node.bookCount > 0 && <span className="coll-badge">{node.bookCount}</span>}
        <span className="coll-row-actions">
          <IconBtn title="New sub-folder" onClick={() => onAddChild(node.id)}>＋</IconBtn>
          <IconBtn title="Rename" onClick={() => onRename(node)}>✎</IconBtn>
          <IconBtn title="Delete" onClick={() => onDelete(node)}>🗑</IconBtn>
        </span>
      </div>
      {isOpen &&
        node.children.map(child => (
          <FolderRow
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            expanded={expanded}
            onSelect={onSelect}
            onToggleExpand={onToggleExpand}
            onAddChild={onAddChild}
            onRename={onRename}
            onDelete={onDelete}
            dndProps={dndProps}
          />
        ))}
    </>
  );
}

function IconBtn({ title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      className="coll-icon-btn"
      onClick={e => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}
