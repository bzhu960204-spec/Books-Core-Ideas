import { useEffect, useMemo, useState } from 'react';
import { bookCollectionApi } from '../../api';
import { buildFolderTree } from './CollectionTree';

/** Flatten the folder tree into rows carrying their depth for indentation. */
function flatten(nodes, depth = 0) {
  const out = [];
  for (const n of nodes) {
    out.push({ node: n, depth });
    if (n.children.length) out.push(...flatten(n.children, depth + 1));
  }
  return out;
}

export default function AddToCollectionModal({ bookId, bookTitle, onClose, onChanged }) {
  const [collections, setCollections] = useState([]);
  const [memberIds, setMemberIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const reload = () =>
    Promise.all([bookCollectionApi.list(), bookCollectionApi.collectionsForBook(bookId)])
      .then(([cols, ids]) => {
        setCollections(cols);
        setMemberIds(new Set(ids));
      })
      .catch(err => console.error('Failed to load collections:', err))
      .finally(() => setLoading(false));

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const rows = useMemo(() => flatten(buildFolderTree(collections)), [collections]);

  const toggle = async (col) => {
    setBusyId(col.id);
    try {
      if (memberIds.has(col.id)) {
        await bookCollectionApi.removeBook(col.id, bookId);
        setMemberIds(prev => {
          const next = new Set(prev);
          next.delete(col.id);
          return next;
        });
      } else {
        await bookCollectionApi.addBook(col.id, bookId);
        setMemberIds(prev => new Set(prev).add(col.id));
      }
      onChanged?.();
    } catch (err) {
      console.error('Failed to toggle membership:', err);
    } finally {
      setBusyId(null);
    }
  };

  const createFolder = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const col = await bookCollectionApi.create(name, null);
      setNewName('');
      await bookCollectionApi.addBook(col.id, bookId);
      await reload();
      onChanged?.();
    } catch (err) {
      console.error('Failed to create folder:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal--sm">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <h3 className="modal-title">Add to Collection</h3>
        <p className="coll-modal-subtitle" title={bookTitle}>{bookTitle}</p>

        {loading ? (
          <p className="coll-tree-empty">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="coll-tree-empty">No collections yet. Create one below.</p>
        ) : (
          <ul className="coll-pick-list">
            {rows.map(({ node, depth }) => {
              const checked = memberIds.has(node.id);
              return (
                <li key={node.id} style={{ paddingLeft: depth * 18 }}>
                  <label className="coll-pick-row">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busyId === node.id}
                      onChange={() => toggle(node)}
                    />
                    <span className="coll-folder-icon">📁</span>
                    <span className="coll-folder-name">{node.name}</span>
                    {node.bookCount > 0 && <span className="coll-badge">{node.bookCount}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <div className="coll-create-row">
          <input
            type="text"
            placeholder="New collection name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createFolder(); }}
          />
          <button className="btn btn-primary btn-sm" disabled={creating || !newName.trim()} onClick={createFolder}>
            Create & add
          </button>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
