import { useState } from 'react';
import JSZip from 'jszip';
import Modal from './Modal';

// Export chapter explanations. Unlike a combined document, each selected chapter
// is exported as its OWN self-contained file (HTML or print-to-PDF), each with a
// cover, the chapter content, and a collapsible table-of-contents drawer built
// from the content's own headings.
export default function ExplanationExportModal({ chapters, bookTitle, totalChapters, fetchContent, onClose }) {
  const [selected, setSelected] = useState(() => chapters.map(c => c.id));
  const [format, setFormat] = useState('html');
  const [removeLinks, setRemoveLinks] = useState(true);
  const [exporting, setExporting] = useState(false);

  const toggle = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const allSelected = selected.length === chapters.length && chapters.length > 0;
  const toggleAll = () => setSelected(allSelected ? [] : chapters.map(c => c.id));

  const handleExport = async () => {
    if (selected.length === 0) return;
    setExporting(true);
    try {
      const ordered = chapters.filter(c => selected.includes(c.id));
      const padWidth = String(totalChapters || chapters.length || 1).length;

      // Multiple HTML files: bundle into a single book-named zip; the files inside
      // are already numbered so they don't need the book name.
      if (format === 'html' && ordered.length > 1) {
        const zip = new JSZip();
        for (const chapter of ordered) {
          const data = await fetchContent(chapter.id);
          const content = (data && data.content) || '<p><em>No content</em></p>';
          const updatedAt = (data && data.updatedAt) || '';
          const html = buildChapterHtml({
            bookTitle,
            chapterTitle: chapter.title,
            content,
            updatedAt,
            removeLinks,
            includePrintScript: false,
          });
          zip.file(`${chapterFileBase(chapter, padWidth)}.html`, html);
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(blob, `${sanitize(bookTitle)}.zip`);
        onClose();
        return;
      }

      for (const chapter of ordered) {
        const data = await fetchContent(chapter.id);
        const content = (data && data.content) || '<p><em>No content</em></p>';
        const updatedAt = (data && data.updatedAt) || '';
        const html = buildChapterHtml({
          bookTitle,
          chapterTitle: chapter.title,
          content,
          updatedAt,
          removeLinks,
          includePrintScript: format === 'pdf',
        });
        if (format === 'pdf') {
          const win = window.open('', '_blank', 'width=900,height=700');
          if (!win) {
            alert('Please allow pop-ups to export as PDF.');
            break;
          }
          win.document.write(html);
          win.document.close();
        } else {
          downloadHtml(html, `${chapterFileBase(chapter, padWidth)}.html`);
        }
      }
      onClose();
    } catch (err) {
      console.error('Explanation export failed:', err);
      alert('Failed to export explanations.');
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
            {chapters.map(c => (
              <li
                key={c.id}
                onClick={() => toggle(c.id)}
                style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={() => toggle(c.id)}
                  onClick={e => e.stopPropagation()}
                />
                <span>{c.title}</span>
              </li>
            ))}
          </ul>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.9rem' }} title="Strip hyperlinks from the exported files">
              <input type="checkbox" checked={removeLinks} onChange={e => setRemoveLinks(e.target.checked)} />
              <span>No links</span>
            </label>
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
              {exporting ? 'Exporting…' : `Export (${selected.length})`}
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

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Delete whole citation-style links; unwrap the rest to keep their visible text.
function isRemovableLink(text, href) {
  const t = (text || '').trim();
  const h = (href || '').trim();
  if (!t) return true;
  if (/sharepoint\.com/i.test(h) || /\.txt(\?|#|$)/i.test(h)) return true;
  if (/^\[[\s\S]+\|[^\]]*\]$/.test(t)) return true;
  if (/^(https?:\/\/|www\.)\S+$/i.test(t)) return true;
  if (h && t === h) return true;
  return false;
}

function stripLinks(html) {
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_m, attrs, inner) => {
      const hrefMatch = /href\s*=\s*["']([^"']*)["']/i.exec(attrs);
      const text = inner.replace(/<[^>]*>/g, '');
      return isRemovableLink(text, hrefMatch ? hrefMatch[1] : '') ? '' : inner;
    });
  }
  const doc = new DOMParser().parseFromString(`<!doctype html><body><div id="__root">${html}</div>`, 'text/html');
  const root = doc.getElementById('__root');
  if (!root) return html;
  root.querySelectorAll('a').forEach(a => {
    if (isRemovableLink(a.textContent ?? '', a.getAttribute('href') ?? '')) {
      a.remove();
    } else {
      a.replaceWith(...Array.from(a.childNodes));
    }
  });
  return root.innerHTML;
}

// Add ids to h1/h2/h3 in the content so the TOC can deep-link, and collect the
// heading entries. Content h1/h2 become level 2, h3 becomes level 3 (the chapter
// title itself is level 1).
function injectHeadingAnchors(html, sectionId) {
  if (typeof DOMParser === 'undefined') return { html, headings: [] };
  const doc = new DOMParser().parseFromString(`<!doctype html><body><div id="__root">${html}</div>`, 'text/html');
  const root = doc.getElementById('__root');
  if (!root) return { html, headings: [] };
  const headings = [];
  root.querySelectorAll('h1, h2, h3').forEach((el, idx) => {
    const text = (el.textContent ?? '').trim();
    if (!text) return;
    const id = `${sectionId}-h-${idx}`;
    el.setAttribute('id', id);
    const level = el.tagName === 'H3' ? 3 : 2;
    headings.push({ id, text, level });
  });
  return { html: root.innerHTML, headings };
}

function renderTocTree(entries) {
  const roots = [];
  const stack = [];
  for (const entry of entries) {
    const node = { entry, children: [] };
    while (stack.length && stack[stack.length - 1].entry.level >= entry.level) stack.pop();
    if (stack.length) stack[stack.length - 1].children.push(node);
    else roots.push(node);
    stack.push(node);
  }
  const renderNodes = (nodes) =>
    `<ul class="toc-children">\n${nodes.map(n => {
      const { id, text, level } = n.entry;
      const control = n.children.length
        ? '<button type="button" class="toc-caret" aria-label="Toggle section">▾</button>'
        : '<span class="toc-spacer"></span>';
      const kids = n.children.length ? renderNodes(n.children) : '';
      return `<li class="toc-node toc-l${level}"><div class="toc-row">${control}<a href="#${id}">${escapeHtml(text)}</a></div>${kids}</li>`;
    }).join('\n')}\n</ul>`;
  return renderNodes(roots);
}

// Build one self-contained HTML document for a single chapter's explanation.
function buildChapterHtml({ bookTitle, chapterTitle, content, updatedAt, removeLinks, includePrintScript }) {
  const sectionId = 'note-1';
  const stripped = removeLinks ? stripLinks(content) : content;
  const { html: body, headings } = injectHeadingAnchors(stripped, sectionId);

  const toc = [{ id: sectionId, text: chapterTitle, level: 1 }, ...headings];
  const hasToc = toc.length > 1;
  const tocHtml = hasToc
    ? `<input type="checkbox" id="toc-toggle" class="toc-toggle" hidden />
<label for="toc-toggle" class="toc-fab" title="Contents" aria-label="Open contents">
  <span class="toc-fab-icon">☰</span>
</label>
<label for="toc-toggle" class="toc-backdrop"></label>
<aside class="toc-drawer" aria-label="Table of contents">
  <div class="toc-drawer-head">
    <span class="toc-title">Contents</span>
    <label for="toc-toggle" class="toc-close" title="Close" aria-label="Close contents">×</label>
  </div>
  <nav class="toc">
${renderTocTree(toc)}
  </nav>
</aside>`
    : '';

  const tocScript = hasToc
    ? `
<script>
  (function () {
    var toggle = document.getElementById('toc-toggle');
    if (toggle) {
      document.querySelectorAll('.toc a').forEach(function (a) {
        a.addEventListener('click', function () { toggle.checked = false; });
      });
    }
    document.querySelectorAll('.toc-caret').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var node = btn.closest('.toc-node');
        if (node) node.classList.toggle('collapsed');
      });
    });
  })();
<\/script>`
    : '';

  const printScript = includePrintScript
    ? `
<script>
  window.addEventListener('load', function () {
    setTimeout(function () { window.print(); }, 150);
    window.onafterprint = function () { window.close(); };
  });
<\/script>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(chapterTitle)} — Explanation</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body {
    font-family: 'Inter', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'SimSun', system-ui, sans-serif;
    font-size: 11pt; color: #1f2328; background: #eceef1; line-height: 1.75;
    -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  }
  .sheet { max-width: 760px; margin: 40px auto 72px; padding: 48px 56px; background: #fff; border-radius: 12px; box-shadow: 0 1px 2px rgba(16,24,40,0.08), 0 12px 32px rgba(16,24,40,0.08); }
  .cover { margin-bottom: 24pt; padding-bottom: 12pt; border-bottom: 2px solid #333; }
  .cover h1 { font-size: 18pt; margin: 0 0 4pt; font-weight: 700; letter-spacing: -0.01em; }
  .cover p { font-size: 9pt; color: #666; margin: 0; }
  .toc-toggle { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
  .toc-fab { position: fixed; top: 20px; left: 20px; z-index: 50; width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #1f2328; color: #fff; cursor: pointer; box-shadow: 0 6px 18px rgba(16,24,40,0.22); transition: opacity .2s ease, transform .2s ease, background .2s ease; }
  .toc-fab:hover { transform: translateY(-1px); background: #2d333b; }
  .toc-fab-icon { font-size: 19px; line-height: 1; }
  .toc-backdrop { position: fixed; inset: 0; z-index: 60; background: rgba(16,24,40,0.38); opacity: 0; visibility: hidden; transition: opacity .25s ease, visibility .25s ease; cursor: pointer; }
  .toc-drawer { position: fixed; top: 0; left: 0; bottom: 0; z-index: 70; width: 308px; max-width: 84vw; display: flex; flex-direction: column; background: #fff; border-right: 1px solid #e2e6ea; box-shadow: 0 0 48px rgba(16,24,40,0.20); transform: translateX(-100%); transition: transform .28s cubic-bezier(.4,0,.2,1); }
  .toc-drawer-head { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid #eef0f2; }
  .toc-close { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 22px; line-height: 1; color: #6b7280; cursor: pointer; transition: background .15s ease, color .15s ease; }
  .toc-close:hover { background: #f1f3f5; color: #1f2328; }
  .toc-toggle:checked ~ .toc-drawer { transform: translateX(0); }
  .toc-toggle:checked ~ .toc-backdrop { opacity: 1; visibility: visible; }
  .toc-toggle:checked ~ .toc-fab { opacity: 0; pointer-events: none; transform: scale(.9); }
  .toc { flex: 1 1 auto; overflow-y: auto; padding: 14px 20px 28px; }
  .toc-title { font-size: 12pt; font-weight: 700; margin: 0; color: #1f2328; }
  .toc ul { list-style: none; margin: 0; padding: 0; }
  .toc > .toc-children { padding-left: 0; }
  .toc li { margin: 2px 0; line-height: 1.5; }
  .toc-row { display: flex; align-items: flex-start; gap: 2px; }
  .toc-caret { flex: 0 0 auto; width: 20px; height: 26px; padding: 0; margin: 0; border: none; background: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #98a2b3; font-size: 10px; line-height: 1; transition: transform .15s ease, color .15s ease; }
  .toc-caret:hover { color: #1f2328; }
  .toc-node.collapsed > .toc-row .toc-caret { transform: rotate(-90deg); }
  .toc-node.collapsed > .toc-children { display: none; }
  .toc-spacer { flex: 0 0 auto; width: 20px; }
  .toc-children { padding-left: 14px; }
  .toc a { flex: 1 1 auto; display: block; padding: 4px 8px; border-radius: 6px; color: #1d4ed8; text-decoration: none; font-size: 10.5pt; transition: background .15s ease; }
  .toc a:hover { background: #f1f5ff; text-decoration: none; }
  .toc .toc-l1 > .toc-row a { font-weight: 600; }
  .toc .toc-l1 { margin-top: 8px; }
  .toc .toc-l1:first-child { margin-top: 0; }
  .toc .toc-l2 > .toc-row a { font-size: 10pt; color: #2a4bb8; }
  .toc .toc-l3 > .toc-row a { font-size: 9.5pt; color: #4a5a8a; }
  .doc-section { margin-bottom: 28pt; }
  .doc-section-title { font-size: 14pt; font-weight: 700; border-left: 4px solid #333; padding: 0 0 0 8pt; margin: 0 0 6pt; letter-spacing: -0.01em; }
  .doc-section-meta { color: #888; font-size: 9pt; margin: 0 0 12pt; }
  .note-content { font-size: 10.5pt; line-height: 1.8; color: #2a2f36; }
  .note-content > :first-child { margin-top: 0; }
  .note-content p { margin: 0 0 0.75em; }
  .note-content h1, .note-content h2, .note-content h3 { margin: 1.2em 0 0.45em; font-weight: 700; color: #1f2328; }
  .note-content h1 { font-size: 14pt; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .note-content h2 { font-size: 12pt; border-bottom: 1px solid #e5e5e5; padding-bottom: 3px; }
  .note-content h3 { font-size: 11pt; }
  .note-content ul, .note-content ol { margin: 0.5em 0 0.75em 1.4em; padding: 0; }
  .note-content li { margin-bottom: 0.35em; }
  .note-content table { border-collapse: collapse; width: 100%; margin: 0.9em 0; font-size: 10pt; table-layout: fixed; }
  .note-content th, .note-content td { border: 1px solid #d7dbe0; padding: 6pt 8pt; vertical-align: top; word-break: break-word; }
  .note-content th { background: #f3f4f6; font-weight: 700; text-align: left; }
  .note-content blockquote { border-left: 3px solid #c4cdd5; padding: 4pt 14pt; color: #555; margin: 0.8em 0; background: #f7f8fa; border-radius: 0 4px 4px 0; }
  .note-content pre { background: #f6f8fa; border: 1px solid #e2e6ea; border-radius: 6px; padding: 10pt 12pt; font-size: 9pt; white-space: pre-wrap; word-break: break-all; font-family: 'JetBrains Mono', 'Consolas', 'Courier New', monospace; }
  .note-content code { font-family: 'JetBrains Mono', 'Consolas', 'Courier New', monospace; font-size: 9pt; background: #eef0f2; padding: 1px 4px; border-radius: 3px; }
  .note-content pre code { background: none; padding: 0; }
  .note-content img { max-width: 100%; height: auto; border-radius: 4px; }
  .note-content strong { font-weight: 700; }
  .note-content em { font-style: italic; }
  .note-content a { color: #1d4ed8; text-decoration: underline; }
  .note-content hr { border: none; border-top: 1px solid #e2e6ea; margin: 1.4em 0; }
  @media screen { body { font-size: 11.5pt; } .note-content { font-size: 11.5pt; } }
  @media print {
    body { background: #fff; }
    .toc-toggle, .toc-fab, .toc-backdrop, .toc-drawer { display: none !important; }
    .sheet { max-width: none; margin: 0; padding: 0; background: transparent; border-radius: 0; box-shadow: none; }
  }
</style>
</head>
<body>
${tocHtml}
<main class="sheet">
<div class="cover">
  <h1>${escapeHtml(bookTitle || 'Book')}</h1>
  <p>Exported: ${new Date().toLocaleString()} · Chapter explanation</p>
</div>
<section id="${sectionId}" class="doc-section">
  <h2 class="doc-section-title">${escapeHtml(chapterTitle)}</h2>
  ${updatedAt ? `<p class="doc-section-meta">${escapeHtml(formatDate(updatedAt))}</p>` : ''}
  <div class="note-content">${body}</div>
</section>
</main>${tocScript}${printScript}
</body>
</html>`;
}
