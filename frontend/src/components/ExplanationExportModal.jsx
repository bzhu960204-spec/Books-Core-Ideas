import { useState } from 'react';
import JSZip from 'jszip';
import Modal from './Modal';
import { reportError, showToast } from './feedback/toast';
import { buildChapterHtml } from '../utils/exportHtml/buildChapterHtml';
import { loadExportImages } from '../utils/exportHtml/exportImages';

// Export chapter explanations. Unlike a combined document, each selected chapter
// is exported as its OWN self-contained file (HTML or print-to-PDF), each with a
// cover, the chapter content, and a collapsible table-of-contents drawer built
// from the content's own headings.
export default function ExplanationExportModal({ chapters, bookTitle, totalChapters, fetchContent, onClose }) {
  const [selected, setSelected] = useState(() => chapters.map(c => c.id));
  const [format, setFormat] = useState('html');
  const [removeLinks, setRemoveLinks] = useState(true);
  const [includeImages, setIncludeImages] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState('');

  const toggle = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const allSelected = selected.length === chapters.length && chapters.length > 0;
  const toggleAll = () => setSelected(allSelected ? [] : chapters.map(c => c.id));
  const canIncludeImages = format === 'html' && chapters.some(c => selected.includes(c.id) && c.imageCount > 0);

  const handleExport = async () => {
    if (selected.length === 0) return;
    setExporting(true);
    try {
      const ordered = chapters.filter(c => selected.includes(c.id));
      const padWidth = String(totalChapters || chapters.length || 1).length;
      const withImages = format === 'html' && includeImages;
      let failedImages = 0;

      // One chapter at a time, so only one chapter's images are in memory at once.
      const renderChapter = async (chapter, index) => {
        setProgress(`${index + 1}/${ordered.length}`);
        const data = await fetchContent(chapter.id);
        const content = (data && data.content) || '<p><em>No content</em></p>';
        const updatedAt = (data && data.updatedAt) || '';
        const loaded = withImages && chapter.imageCount > 0
          ? await loadExportImages(chapter.id, chapter.imageCount)
          : { images: [], failed: 0 };
        failedImages += loaded.failed;
        return buildChapterHtml({
          bookTitle,
          chapterTitle: chapter.title,
          content,
          updatedAt,
          removeLinks,
          includePrintScript: format === 'pdf',
          images: loaded.images,
        });
      };
      const reportFailedImages = () => {
        if (failedImages > 0) showToast(`${failedImages} image(s) couldn't be included in the export.`);
      };

      // Multiple HTML files: bundle into a single book-named zip; the files inside
      // are already numbered so they don't need the book name.
      if (format === 'html' && ordered.length > 1) {
        const zip = new JSZip();
        for (const [index, chapter] of ordered.entries()) {
          zip.file(`${chapterFileBase(chapter, padWidth)}.html`, await renderChapter(chapter, index));
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(blob, `${sanitize(bookTitle)}.zip`);
        reportFailedImages();
        onClose();
        return;
      }

      for (const [index, chapter] of ordered.entries()) {
        const html = await renderChapter(chapter, index);
        if (format === 'pdf') {
          const win = window.open('', '_blank', 'width=900,height=700');
          if (!win) {
            showToast('Allow pop-ups for this site to export as PDF.');
            break;
          }
          win.document.write(html);
          win.document.close();
        } else {
          downloadHtml(html, `${chapterFileBase(chapter, padWidth)}.html`);
        }
      }
      reportFailedImages();
      onClose();
    } catch (err) {
      reportError('Could not export the explanations', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal size="lg" title="Export Explanations" onClose={onClose}>
      {chapters.length === 0 ? (
        <p className="empty-state-text" style={{ padding: '1rem 0' }}>
          No chapters have an explanation yet.
        </p>
      ) : (
        <>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem' }}>
            Each selected chapter is exported as its own separate file.
          </p>
          <label className="export-checkbox-label" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', fontWeight: 600 }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            <span>Select All ({chapters.length})</span>
          </label>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: '45vh', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
            {chapters.map((c, i) => {
              const prev = chapters[i - 1];
              const showPartHeader = c.partOrder != null && (!prev || prev.partOrder !== c.partOrder);
              return (
                <li key={c.id} style={{ margin: 0, padding: 0 }}>
                  {showPartHeader && (
                    <div style={{ padding: '0.4rem 0.75rem', background: 'var(--bg-secondary, rgba(0,0,0,0.04))', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', letterSpacing: '0.02em' }}>
                      Part {c.partOrder}{c.partTitle ? ` · ${c.partTitle}` : ''}
                    </div>
                  )}
                  <div
                    onClick={() => toggle(c.id)}
                    style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      onChange={() => toggle(c.id)}
                      onClick={e => e.stopPropagation()}
                    />
                    <span style={{ flex: '0 0 auto', minWidth: '1.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-secondary)' }}>{c.seq}.</span>
                    <span>{c.title}</span>
                  </div>
                </li>
              );
            })}
          </ul>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.9rem' }} title="Strip hyperlinks from the exported files">
              <input type="checkbox" checked={removeLinks} onChange={e => setRemoveLinks(e.target.checked)} />
              <span>No links</span>
            </label>
            {canIncludeImages && (
              <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.9rem' }} title="Embed chapter images in the exported files (makes them larger)">
                <input type="checkbox" checked={includeImages} onChange={e => setIncludeImages(e.target.checked)} disabled={exporting} />
                <span>Include images</span>
              </label>
            )}
            <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.9rem' }}>
              <span>Format</span>
              <select className="rte-select" value={format} onChange={e => setFormat(e.target.value)} disabled={exporting}>
                <option value="html">HTML</option>
                <option value="pdf">PDF (print)</option>
              </select>
            </label>
            <span style={{ flex: 1 }} />
            <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={exporting}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleExport} disabled={exporting || selected.length === 0}>
              {exporting ? `Exporting ${progress}…` : `Export (${selected.length})`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function sanitize(name) {
  return (name || 'Untitled').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80);
}

// File name (without extension) carrying reading-order info: a book-wide chapter
// number, prefixed with the part number when the book is organised into parts.
function chapterFileBase(chapter, padWidth) {
  const seqStr = String(chapter.seq).padStart(padWidth, '0');
  const prefix = chapter.partOrder != null ? `P${chapter.partOrder}-${seqStr}` : seqStr;
  return `${prefix} - ${sanitize(chapter.title)}`;
}

function downloadHtml(html, filename) {
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

