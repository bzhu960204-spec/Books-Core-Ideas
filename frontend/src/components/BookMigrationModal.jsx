import { useState, useRef } from 'react';
import Modal from './Modal';
import { migrationApi } from '../api';

/**
 * Whole-book migration: export selected books (metadata + chapters/ideas/
 * excerpts + AI explanations + chapter images) as a ZIP archive, and import
 * such an archive back. Conflicting books (same title + author) are skipped.
 */
export default function BookMigrationModal({ books, onClose, onImported }) {
  const [tab, setTab] = useState('export');

  return (
    <Modal title="Migrate Books" onClose={onClose} size="lg">
      <div className="import-tabs">
        <button
          type="button"
          className={`import-tab${tab === 'export' ? ' active' : ''}`}
          onClick={() => setTab('export')}
        >
          ↧ Export
        </button>
        <button
          type="button"
          className={`import-tab${tab === 'import' ? ' active' : ''}`}
          onClick={() => setTab('import')}
        >
          ↥ Import
        </button>
      </div>

      {tab === 'export'
        ? <ExportPanel books={books} onClose={onClose} />
        : <ImportPanel onClose={onClose} onImported={onImported} />}
    </Modal>
  );
}

function ExportPanel({ books, onClose }) {
  const [selected, setSelected] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [error, setError] = useState('');

  const filtered = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter(b =>
      (b.title || '').toLowerCase().includes(q) ||
      (b.author || '').toLowerCase().includes(q)
    );
  })();

  const allFilteredSelected = filtered.length > 0 && filtered.every(b => selected.has(b.id));

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Select-all operates on the currently visible (filtered) books only.
  const toggleAll = () => setSelected(prev => {
    const next = new Set(prev);
    if (allFilteredSelected) filtered.forEach(b => next.delete(b.id));
    else filtered.forEach(b => next.add(b.id));
    return next;
  });

  const handleExport = async () => {
    setStatus('loading');
    setError('');
    try {
      const { blob, filename } = await migrationApi.exportBooks([...selected]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus('idle');
      onClose();
    } catch (err) {
      setError(err.message || 'Export failed');
      setStatus('idle');
    }
  };

  if (books.length === 0) {
    return <p style={{ color: 'var(--text-muted)' }}>Your library is empty — nothing to export.</p>;
  }

  return (
    <div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 0 }}>
        Select the books to export. The archive includes book details, chapters, key ideas,
        excerpts, AI explanations and chapter images.
      </p>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by title or author…"
        style={{ width: '100%', boxSizing: 'border-box', marginBottom: '0.5rem' }}
      />

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.5rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} disabled={filtered.length === 0} />
        {query.trim()
          ? `Select all (${filtered.filter(b => selected.has(b.id)).length} / ${filtered.length} shown)`
          : `Select all (${selected.size} / ${books.length})`}
      </label>

      <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem' }}>
        {filtered.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: '0.75rem 0' }}>
            No books match “{query.trim()}”.
          </p>
        ) : filtered.map(book => (
          <label
            key={book.id}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.25rem', cursor: 'pointer' }}
          >
            <input type="checkbox" checked={selected.has(book.id)} onChange={() => toggle(book.id)} />
            <span style={{ fontWeight: 500 }}>{book.title}</span>
            {book.author && <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>— {book.author}</span>}
          </label>
        ))}
      </div>

      {error && <div className="json-error" style={{ marginTop: '0.75rem' }}>{error}</div>}

      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleExport}
          disabled={selected.size === 0 || status === 'loading'}
        >
          {status === 'loading' ? 'Exporting…' : `Export ${selected.size} book${selected.size !== 1 ? 's' : ''} (ZIP)`}
        </button>
      </div>
    </div>
  );
}

function ImportPanel({ onClose, onImported }) {
  const [items, setItems] = useState([]); // { key, file, preview, previewError, previewing }
  const [results, setResults] = useState(null); // [{ fileName, result?, error? }]
  const [status, setStatus] = useState('idle'); // idle | importing
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const isZip = (f) => /\.zip$/i.test(f.name) || f.type === 'application/zip' || f.type === 'application/x-zip-compressed';

  const addFiles = async (fileList) => {
    setResults(null);
    setError('');
    const incoming = Array.from(fileList).filter(Boolean);
    const rejected = incoming.filter(f => !isZip(f));
    const zips = incoming.filter(isZip);
    if (rejected.length) {
      setError(`Ignored ${rejected.length} non-zip file${rejected.length !== 1 ? 's' : ''}.`);
    }
    // Skip files already in the list (by name + size).
    const existing = new Set(items.map(it => `${it.file.name}:${it.file.size}`));
    const fresh = zips.filter(f => !existing.has(`${f.name}:${f.size}`));
    if (!fresh.length) return;

    const newItems = fresh.map(f => ({
      key: `${f.name}:${f.size}:${Date.now()}:${Math.random()}`,
      file: f,
      preview: null,
      previewError: null,
      previewing: true,
    }));
    setItems(prev => [...prev, ...newItems]);

    for (const it of newItems) {
      try {
        const data = await migrationApi.preview(it.file);
        setItems(prev => prev.map(x => x.key === it.key ? { ...x, preview: data, previewing: false } : x));
      } catch (err) {
        setItems(prev => prev.map(x => x.key === it.key ? { ...x, previewError: err.message || 'Could not read archive', previewing: false } : x));
      }
    }
  };

  const removeItem = (key) => setItems(prev => prev.filter(x => x.key !== key));

  const handleInput = (e) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = ''; // allow re-selecting the same file
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const importable = items.filter(it => it.preview && (it.preview.totalBooks - it.preview.conflicts) > 0);
  const totalImportable = importable.reduce((n, it) => n + (it.preview.totalBooks - it.preview.conflicts), 0);

  const handleImport = async () => {
    if (!importable.length) return;
    setStatus('importing');
    setError('');
    setProgress({ current: 0, total: importable.length });
    const out = [];
    for (let i = 0; i < importable.length; i++) {
      const it = importable[i];
      setProgress({ current: i + 1, total: importable.length });
      try {
        const data = await migrationApi.import(it.file);
        out.push({ fileName: it.file.name, result: data });
      } catch (err) {
        out.push({ fileName: it.file.name, error: err.message || 'Import failed' });
      }
    }
    setResults(out);
    setStatus('idle');
    onImported?.();
  };

  // Aggregate totals for the final summary.
  const summary = results?.reduce((acc, r) => {
    if (r.result) {
      acc.imported += r.result.booksImported;
      acc.skipped += r.result.booksSkipped;
      acc.failed += r.result.booksFailed;
    } else {
      acc.fileErrors += 1;
    }
    return acc;
  }, { imported: 0, skipped: 0, failed: 0, fileErrors: 0 });

  return (
    <div>
      {!results && (
        <>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 0 }}>
            Drop one or more migration archives (<code>.zip</code>) exported from this app, or
            click to browse. Books that already exist (same title and author) are skipped.
          </p>

          <div
            className={`import-dropzone${dragActive ? ' active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
          >
            <span style={{ fontSize: '1.4rem' }}>↥</span>
            <span>Drag &amp; drop ZIP files here, or click to browse</span>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            multiple
            onChange={handleInput}
            style={{ display: 'none' }}
          />
        </>
      )}

      {!results && items.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            <strong>{totalImportable}</strong> book{totalImportable !== 1 ? 's' : ''} ready to import
            {' '}from {items.length} file{items.length !== 1 ? 's' : ''}
          </div>
          <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem' }}>
            {items.map(it => (
              <div key={it.key} style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.file.name}</span>
                  {it.previewing && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>reading…</span>}
                  <button
                    type="button"
                    onClick={() => removeItem(it.key)}
                    title="Remove"
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
                {it.previewError && (
                  <div className="json-error" style={{ marginTop: '0.25rem' }}>{it.previewError}</div>
                )}
                {it.preview && (
                  <>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.15rem 0 0.25rem' }}>
                      {it.preview.totalBooks} book{it.preview.totalBooks !== 1 ? 's' : ''}
                      {it.preview.conflicts > 0 && <span style={{ color: '#e0912b' }}> · {it.preview.conflicts} skipped</span>}
                    </div>
                    {it.preview.books.map((b, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0.5rem', opacity: b.conflict ? 0.55 : 1 }}>
                        <span style={{ fontWeight: 500 }}>{b.title}</span>
                        {b.author && <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>— {b.author}</span>}
                        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {b.chapterCount} ch · {b.imageCount} img{b.hasExplanations ? ' · 详解' : ''}
                        </span>
                        {b.conflict && (
                          <span style={{ fontSize: '0.72rem', color: '#e0912b', border: '1px solid #e0912b', borderRadius: '4px', padding: '0 0.3rem' }}>
                            skip
                          </span>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {results && (
        <div style={{ marginTop: '0.25rem' }}>
          <div className="json-success" style={{ marginBottom: '0.5rem' }}>
            Imported {summary.imported}, skipped {summary.skipped}, failed {summary.failed}
            {summary.fileErrors > 0 && ` · ${summary.fileErrors} file${summary.fileErrors !== 1 ? 's' : ''} unreadable`}.
          </div>
          <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem' }}>
            {results.map((r, fi) => (
              <div key={fi} style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem' }}>{r.fileName}</div>
                {r.error ? (
                  <div className="json-error">{r.error}</div>
                ) : r.result.details.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0.5rem' }}>
                    <span style={{ fontWeight: 500 }}>{d.title}</span>
                    {d.author && <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>— {d.author}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: statusColor(d.status) }}>
                      {statusLabel(d)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="json-error" style={{ marginTop: '0.75rem' }}>{error}</div>}

      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          {results ? 'Close' : 'Cancel'}
        </button>
        {!results && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleImport}
            disabled={totalImportable === 0 || status === 'importing'}
          >
            {status === 'importing'
              ? `Importing ${progress.current} / ${progress.total}…`
              : `Import ${totalImportable} book${totalImportable !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>
    </div>
  );
}

function statusColor(status) {
  if (status === 'IMPORTED') return '#2e9e5b';
  if (status === 'SKIPPED_CONFLICT') return '#e0912b';
  return '#e05252';
}

function statusLabel(d) {
  if (d.status === 'IMPORTED') return `✓ ${d.chaptersImported} ch · ${d.imagesImported} img`;
  if (d.status === 'SKIPPED_CONFLICT') return 'skipped (exists)';
  return `failed: ${d.message || ''}`;
}
