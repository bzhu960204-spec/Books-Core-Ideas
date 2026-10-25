import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Table, TableHeader, TableCell } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { useEffect, useRef, useState, useCallback } from 'react';
import { marked } from 'marked';
import LinkFixPrompt from './LinkFixPrompt';
import { analyzeHtmlLinks } from '../utils/linkFix';

// Custom extension: adds a `fontSize` attribute to the textStyle mark so the
// font-size dropdown can read/write inline `style="font-size: …"`.
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: el => el.style.fontSize?.replace(/['"]/g, '') || null,
            renderHTML: attrs => {
              if (!attrs.fontSize) return {};
              return { style: `font-size: ${attrs.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: size => ({ chain }) =>
        chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }) =>
        chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

// ── Markdown paste support ────────────────────────────────────────────────────
// Heuristics: does this plain text look like Markdown source worth converting?
const FENCED_CODE_RE = /(^|\n)\s*```/;
const MD_FEATURE_RE = /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s)|(\*\*|__).+?(\*\*|__)|\[[^\]]+\]\([^)]+\)|(^|\n)\|.+\|/;

function looksLikeMarkdown(text) {
  return FENCED_CODE_RE.test(text) || MD_FEATURE_RE.test(text);
}

// Convert Markdown → HTML while protecting math ($…$, $$…$$) and fenced code
// from being mangled by Markdown inline rules.
function markdownToHtml(src) {
  const stash = [];
  const keep = (s) => {
    const token = `\u0000MD${stash.length}\u0000`;
    stash.push(s);
    return token;
  };
  let text = src.replace(/\r\n/g, '\n');
  text = text.replace(/```[\s\S]*?```/g, m => keep(m));
  text = text.replace(/\$\$[\s\S]*?\$\$/g, m => keep(m));
  text = text.replace(/\$[^\n$]+?\$/g, m => keep(m));
  let html = marked.parse(text, { breaks: false, gfm: true, async: false });
  html = html.replace(/\u0000MD(\d+)\u0000/g, (_, i) => stash[Number(i)] ?? '');
  return html;
}

// ── Copilot rich-answer pseudo-code blocks ────────────────────────────────────
// Copilot's rich (HTML) answers render code as a run of one-line <div><span>
// rows bounded by empty <p>s — not a <pre>, so it pastes as loose paragraphs.
// The signature only exists in the raw clipboard HTML, so it is detected at
// paste time and rewritten into real <pre><code> on demand.
function transformCopilotCodeBlocks(html) {
  if (!html || !/<div/i.test(html)) return { html, count: 0 };
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const isEmptyP = (el) => !!el && el.tagName === 'P' && (el.textContent ?? '').trim() === '';
  const isCodeDiv = (el) => {
    if (!el || el.tagName !== 'DIV') return false;
    const kids = Array.from(el.children);
    return kids.length > 0 && kids.every(k => k.tagName === 'SPAN' || k.tagName === 'BR');
  };

  const matches = [];
  const consumed = new Set();
  for (const opener of Array.from(doc.querySelectorAll('p')).filter(isEmptyP)) {
    if (consumed.has(opener)) continue;
    const divs = [];
    let sib = opener.nextElementSibling;
    while (isCodeDiv(sib)) {
      divs.push(sib);
      sib = sib.nextElementSibling;
    }
    if (divs.length === 0 || !isEmptyP(sib)) continue;
    matches.push({ opener, closer: sib, divs });
    consumed.add(opener);
    consumed.add(sib);
  }

  // A single-line run whose <code> holds escaped line markup is a broken card:
  // repair it but leave it uncounted so only "Fix broken code blocks" claims it.
  const broken = new Map();
  for (const { opener, divs } of matches) {
    const inner = divs.length === 1 ? divs[0].querySelector('code') : null;
    const repaired = inner ? repairEscapedCodeLines(inner.textContent ?? '') : null;
    if (repaired !== null) broken.set(opener, repaired);
  }

  for (const { opener, closer, divs } of matches) {
    const pre = doc.createElement('pre');
    const code = doc.createElement('code');
    // textContent decodes entities and keeps leading spaces (indentation).
    code.textContent = broken.get(opener)
      ?? divs.map(d => (d.querySelector('span') ?? d).textContent ?? '').join('\n');
    pre.appendChild(code);
    opener.parentNode?.insertBefore(pre, opener);
    divs.forEach(d => d.remove());
    opener.remove();
    closer.remove();
  }

  return { html: doc.body.innerHTML, count: matches.length - broken.size };
}

// ── Pasted images ─────────────────────────────────────────────────────────────
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function tooLargeNotice() {
  window.alert('Image is larger than 5 MB and was skipped.');
}

// Remove inline base64 images over the size limit from pasted HTML.
function dropOversizeImages(html) {
  if (!html || !/<img\b/i.test(html)) return html;
  let dropped = false;
  const out = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const m = /\bsrc\s*=\s*["']data:[^"',]*;base64,([^"']*)["']/i.exec(tag);
    if (m && (m[1].length * 3) / 4 > MAX_IMAGE_BYTES) {
      dropped = true;
      return '';
    }
    return tag;
  });
  if (dropped) tooLargeNotice();
  return out;
}

// Read image files as data URLs, skipping (and reporting) oversize ones.
async function readImageFiles(files) {
  const ok = files.filter(f => f.size <= MAX_IMAGE_BYTES);
  if (ok.length < files.length) tooLargeNotice();
  return Promise.all(ok.map(f => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  })));
}

// ── Markdown cards (rich paste) ───────────────────────────────────────────────
// AI chat UIs render a ```markdown fence as a "Markdown" card. The clipboard HTML
// carries it as a bare base64 screenshot <img>, while text/plain holds the card's
// raw Markdown with NO fence between the surrounding prose. Each image is located
// in the plain text via the HTML text just before/after it.
const ANCHOR_LEN = 24;
// Ignored when aligning HTML text with plain text (Markdown syntax differs).
const ALIGN_NOISE = /[\s*_`~#>-]/;

// Drop noise chars, keeping each kept char's index in the original string.
function flattenForAlign(s) {
  let text = '';
  const idx = [];
  for (let i = 0; i < s.length; i += 1) {
    if (ALIGN_NOISE.test(s[i])) continue;
    text += s[i];
    idx.push(i);
  }
  return { text, idx };
}

// Tag each card screenshot with its Markdown source (data-markdown-source,
// URI-encoded). Returns `html` unchanged when no card source was recovered.
function tagMarkdownCards(html, plain) {
  if (!html || !plain || !/<img\b[^>]*\bsrc\s*=\s*["']data:image\//i.test(html)) return html;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const imgs = Array.from(doc.querySelectorAll('img'))
    .filter(img => /^data:image\//i.test(img.getAttribute('src') ?? ''));
  if (!imgs.length) return html;

  const MARK = '\uE000';
  const markers = imgs.map((img) => {
    const t = doc.createTextNode(MARK);
    img.before(t);
    return t;
  });
  const segs = (doc.body.textContent ?? '').split(MARK);
  const flat = flattenForAlign(plain);

  let cursor = 0;
  const bodies = markers.map((_, k) => {
    const before = flattenForAlign(segs[k] ?? '').text.slice(-ANCHOR_LEN);
    const after = flattenForAlign(segs[k + 1] ?? '').text.slice(0, ANCHOR_LEN);

    let startFlat = cursor;
    if (before) {
      const i = flat.text.indexOf(before, cursor);
      if (i < 0) return null;
      startFlat = i + before.length;
    }
    let endFlat = flat.text.length;
    if (after) {
      const j = flat.text.indexOf(after, startFlat);
      if (j < 0) return null;
      endFlat = j;
    }

    const start = startFlat === 0 ? 0 : flat.idx[startFlat - 1] + 1;
    const end = endFlat >= flat.text.length ? plain.length : flat.idx[endFlat];
    // Strip blank edge lines but keep the first line's own indentation.
    const body = plain.slice(start, end).replace(/^\s*\n/, '').trimEnd();
    if (!body.trim()) return null;
    cursor = endFlat;
    return body;
  });

  if (!bodies.some(b => b !== null)) return html;

  markers.forEach((t, k) => {
    if (bodies[k] != null) imgs[k].setAttribute('data-markdown-source', encodeURIComponent(bodies[k]));
    t.remove();
  });
  return doc.body.innerHTML;
}

// ── Broken Copilot "Plain Text" code blocks ───────────────────────────────────
// A card whose lines are ```lang / body / ``` pastes as ONE inline `code` run: the
// fences become code-span delimiters and the lines inside are their own escaped
// <div><span> markup. The text is in the doc, so it can be repaired any time.
const ESCAPED_LINES_RE = /<\/(?:span|div)>\s*<div\b/;

// Decode escaped line markup and put the eaten ``` pair back; null if not such text.
function repairEscapedCodeLines(raw) {
  if (!ESCAPED_LINES_RE.test(raw)) return null;
  const parsed = new DOMParser().parseFromString(`<div><span>${raw}</span></div>`, 'text/html');
  const lines = Array.from(parsed.body.children).map(d => d.textContent ?? '');
  return lines.length < 2 ? null : '```' + lines.join('\n') + '```';
}

function collectBrokenCodeOps(doc) {
  const ops = [];
  let lastTo = -1;
  doc.descendants((node, pos) => {
    if (node.type.name === 'codeBlock') return false;
    if (node.type.name !== 'paragraph') return true;
    const child = node.childCount === 1 ? node.firstChild : null;
    if (!child?.isText || !child.marks.some(m => m.type.name === 'code')) return false;
    const text = repairEscapedCodeLines(child.text ?? '');
    if (text === null) return false;

    // Also swallow the empty paragraphs Copilot leaves around the block.
    const $pos = doc.resolve(pos);
    const parent = $pos.parent;
    const idx = $pos.index();
    const isEmptyP = n => !!n && n.type.name === 'paragraph' && n.content.size === 0;
    let from = pos;
    let to = pos + node.nodeSize;
    const prev = idx > 0 ? parent.child(idx - 1) : null;
    if (isEmptyP(prev) && from - prev.nodeSize >= lastTo) from -= prev.nodeSize;
    const next = idx + 1 < parent.childCount ? parent.child(idx + 1) : null;
    if (isEmptyP(next)) to += next.nodeSize;

    ops.push({ from, to, text });
    lastTo = to;
    return false;
  });
  return ops;
}

// Images tagged at paste time with their Markdown source (see tagMarkdownCards).
function collectCardImageOps(doc) {
  const ops = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'image' && node.attrs.markdownSource) {
      ops.push({ from: pos, to: pos + node.nodeSize, text: node.attrs.markdownSource });
    }
    return true;
  });
  return ops;
}

// ── Resizable image node view (drag the corner handle to resize) ──────────────
function ResizableImageView({ node, updateAttributes, editor }) {
  const imgRef = useRef(null);
  const drag = useRef({ startX: 0, startW: 0 });

  const onResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    drag.current.startX = e.clientX;
    drag.current.startW = imgRef.current?.offsetWidth ?? (node.attrs.width ?? 300);
    const onMove = (mv) => {
      const newW = Math.max(50, Math.round(drag.current.startW + mv.clientX - drag.current.startX));
      updateAttributes({ width: newW });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [updateAttributes, node.attrs.width]);

  const isEditable = editor?.isEditable ?? false;
  const w = node.attrs.width ?? null;

  return (
    <NodeViewWrapper as="div" className="rte-img-wrap" contentEditable={false}>
      <img
        ref={imgRef}
        src={node.attrs.src}
        alt={node.attrs.alt ?? ''}
        title={node.attrs.title ?? undefined}
        style={w ? { width: `${w}px`, maxWidth: '100%' } : { maxWidth: '100%' }}
      />
      {isEditable && <span className="rte-img-resize-handle" onMouseDown={onResizeMouseDown} />}
    </NodeViewWrapper>
  );
}

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      // Markdown source of a pasted card screenshot, URI-encoded so no raw `<`/`>` is stored.
      markdownSource: {
        default: null,
        parseHTML: el => {
          const raw = el.getAttribute('data-markdown-source');
          if (!raw) return null;
          try {
            return decodeURIComponent(raw);
          } catch {
            return null;
          }
        },
        renderHTML: attrs =>
          attrs.markdownSource ? { 'data-markdown-source': encodeURIComponent(attrs.markdownSource) } : {},
      },
      width: {
        default: null,
        parseHTML: el => {
          const raw = el.getAttribute('width') || el.style.width;
          if (!raw) return null;
          const n = parseInt(raw, 10);
          return isNaN(n) ? null : n;
        },
        renderHTML: attrs => {
          if (!attrs.width) return {};
          return { width: String(attrs.width), style: `width:${attrs.width}px` };
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Monospace', value: 'Menlo, Consolas, monospace' },
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Merriweather', value: 'Merriweather, Georgia, serif' },
];

const FONT_SIZES = [
  { label: 'Default', value: '' },
  { label: 'Small', value: '12px' },
  { label: 'Normal', value: '14px' },
  { label: 'Medium', value: '16px' },
  { label: 'Large', value: '18px' },
  { label: 'X-Large', value: '22px' },
  { label: 'Huge', value: '28px' },
];

const COLORS = [
  '#000000', '#374151', '#6b7280', '#ef4444', '#f59e0b',
  '#10b981', '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
];

// Detect whether existing content is already HTML (from new editor) or
// legacy Markdown (from the old textarea-based reviews).
function isLikelyHtml(s) {
  if (!s) return false;
  return /<\/?(p|h[1-6]|ul|ol|li|strong|em|u|s|blockquote|br|span|a|div|hr|pre|code)\b/i.test(s);
}

export function normalizeReviewContent(content) {
  if (!content) return '';
  if (isLikelyHtml(content)) return content;
  try {
    return marked.parse(content, { breaks: true, gfm: true });
  } catch {
    return content;
  }
}

export default function RichTextEditor({ value, onChange, placeholder, autoFocus = false, fill = false }) {
  const initialHtmlRef = useRef(normalizeReviewContent(value));
  const fileInputRef = useRef(null);

  // How pasted content is interpreted: auto-detect Markdown, keep rich HTML, or
  // always parse plain text as Markdown. A ref mirrors it for the paste handler.
  const [pasteMode, setPasteMode] = useState('auto');
  const pasteModeRef = useRef('auto');
  pasteModeRef.current = pasteMode;

  // Secondary toolbar (fonts, colors, alignment, etc.) is collapsed by default
  // to keep the editing surface tall; core actions live in the compact row.
  const [showMore, setShowMore] = useState(false);

  // Pending malformed-link prompt from the "scan & fix" button: { fixes, fixedHtml }.
  const [linkPrompt, setLinkPrompt] = useState(null);

  // Just-pasted Copilot answer whose pseudo-code blocks can be rendered as real
  // code blocks. The raw clipboard HTML lives only in memory, so the offer is
  // dropped once the pasted range is edited. `pendingCopilotRef` carries it from
  // handlePaste to onUpdate, where the pasted range's end is known.
  const [copilotBlocks, setCopilotBlocks] = useState(null);
  const copilotBlocksRef = useRef(null);
  copilotBlocksRef.current = copilotBlocks;
  const pendingCopilotRef = useRef(null);
  const copilotSetAtRef = useRef(0);
  // Set while our own convert/fix transactions run so they don't dismiss the offer.
  const convertingRef = useRef(false);
  const [brokenCodeCount, setBrokenCodeCount] = useState(0);
  const [cardImageCount, setCardImageCount] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Don't silently rewrite content on paste/type; links are applied only
        // via the toolbar or the explicit "scan & fix" action.
        link: { autolink: false, linkOnPaste: false },
      }),
      // TextStyle is already included in StarterKit v3 and supports fontFamily/color
      FontFamily,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ResizableImage.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialHtmlRef.current,
    autofocus: autoFocus,
    onUpdate: ({ editor }) => {
      const pendingC = pendingCopilotRef.current;
      if (pendingC) {
        pendingCopilotRef.current = null;
        setCopilotBlocks({ ...pendingC, to: editor.state.selection.to });
        copilotSetAtRef.current = Date.now();
      } else if (!convertingRef.current && copilotBlocksRef.current && Date.now() - copilotSetAtRef.current > 400) {
        // Later edits invalidate the range; the 400ms window skips the paste's own follow-up transactions.
        setCopilotBlocks(null);
      }
      const html = editor.getHTML();
      // TipTap emits "<p></p>" for empty content — normalize to empty string.
      onChange?.(html === '<p></p>' ? '' : html);
    },
    editorProps: {
      attributes: {
        class: 'rte-content',
        'data-placeholder': placeholder || '',
      },
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData('text/plain') ?? '';
        const html = event.clipboardData?.getData('text/html') ?? '';

        // A bare image (screenshot) has no HTML flavor; copied web/Word/Excel content
        // with an <img> goes through the HTML paths below instead.
        const imageFiles = Array.from(event.clipboardData?.files ?? [])
          .filter(f => f.type.startsWith('image/'));
        if (imageFiles.length && !html) {
          event.preventDefault();
          void readImageFiles(imageFiles).then((srcs) => {
            if (!srcs.length) return;
            editor?.chain().focus()
              .insertContent(srcs.map(src => ({ type: 'image', attrs: { src } }))).run();
          });
          return true;
        }

        const mode = pasteModeRef.current;
        // Rich HTML whose Markdown-card screenshots carry their source.
        const richHtml = tagMarkdownCards(html, text);
        // transformPastedHTML runs before this handler and can't see text/plain, so a
        // tagged paste is inserted manually instead of natively.
        const takeOver = () => {
          if (richHtml === html) return false;
          event.preventDefault();
          editor?.chain().focus().insertContent(dropOversizeImages(richHtml)).run();
          return true;
        };
        const insertAsMarkdown = () => {
          if (!editor || !text) return false;
          event.preventDefault();
          editor.chain().focus().insertContent(markdownToHtml(text)).run();
          return true;
        };

        // Arm the "Render code blocks" button for native (HTML) pastes only.
        const recordCopilot = () => {
          const { count } = transformCopilotCodeBlocks(richHtml);
          if (count > 0) pendingCopilotRef.current = { from: view.state.selection.from, html: richHtml, count };
        };

        if (mode === 'markdown') return insertAsMarkdown();
        if (mode === 'rich') {
          recordCopilot();
          return takeOver();
        }
        // auto: convert only when the text looks like Markdown source.
        if (text && looksLikeMarkdown(text)) return insertAsMarkdown();
        recordCopilot();
        return takeOver();
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? [])
          .filter(f => f.type.startsWith('image/'));
        if (!files.length) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void readImageFiles(files).then((srcs) => {
          if (!srcs.length) return;
          const nodes = srcs.map(src => ({ type: 'image', attrs: { src } }));
          const chain = editor?.chain().focus();
          (pos == null ? chain?.insertContent(nodes) : chain?.insertContentAt(pos, nodes))?.run();
        });
        return true;
      },
      transformPastedHTML: html => dropOversizeImages(html),
    },
  });

  // Sync external value changes (e.g. when switching which review is being edited)
  useEffect(() => {
    if (!editor) return;
    const incoming = normalizeReviewContent(value);
    if (incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  // Rewrite the just-pasted range with its pseudo-code blocks as real code blocks.
  const renderCopilotBlocks = useCallback(() => {
    const info = copilotBlocksRef.current;
    if (!editor || !info) return;
    const size = editor.state.doc.content.size;
    const from = Math.min(info.from, size);
    const to = Math.min(info.to, size);
    if (to > from) {
      const { html } = transformCopilotCodeBlocks(info.html);
      convertingRef.current = true;
      editor.chain().focus().insertContentAt({ from, to }, dropOversizeImages(html)).run();
      convertingRef.current = false;
    }
    setCopilotBlocks(null);
  }, [editor]);

  // Repair every broken "Plain Text" block in one undoable step, back-to-front so
  // earlier positions stay valid.
  const fixBrokenCodeBlocks = useCallback(() => {
    if (!editor) return;
    const ops = collectBrokenCodeOps(editor.state.doc).sort((a, b) => b.from - a.from);
    if (!ops.length) return;
    const { schema } = editor.state;
    let tr = editor.state.tr;
    for (const op of ops) {
      tr = tr.replaceWith(op.from, op.to, schema.nodes.codeBlock.create(null, schema.text(op.text)));
    }
    convertingRef.current = true;
    editor.view.dispatch(tr);
    convertingRef.current = false;
    // Keep a pending Render offer's range valid across this edit.
    const offer = copilotBlocksRef.current;
    if (offer) setCopilotBlocks({ ...offer, to: tr.mapping.map(offer.to) });
    editor.commands.focus();
  }, [editor]);

  // Replace each Markdown-card screenshot with a markdown code block of its source.
  const convertCardImages = useCallback(() => {
    if (!editor) return;
    const ops = collectCardImageOps(editor.state.doc).sort((a, b) => b.from - a.from);
    if (!ops.length) return;
    const { schema } = editor.state;
    let tr = editor.state.tr;
    for (const op of ops) {
      tr = tr.replaceWith(
        op.from,
        op.to,
        schema.nodes.codeBlock.create({ language: 'markdown' }, schema.text(op.text)),
      );
    }
    convertingRef.current = true;
    editor.view.dispatch(tr);
    convertingRef.current = false;
    // Positions shifted, so a pending Render offer is stale.
    setCopilotBlocks(null);
    editor.commands.focus();
  }, [editor]);

  // Keep the repair counts fresh while the "more" toolbar is open (debounced).
  useEffect(() => {
    if (!editor || !showMore) return undefined;
    let timer;
    const refresh = () => {
      setBrokenCodeCount(collectBrokenCodeOps(editor.state.doc).length);
      setCardImageCount(collectCardImageOps(editor.state.doc).length);
    };
    const onEditorUpdate = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 300);
    };
    refresh();
    editor.on('update', onEditorUpdate);
    return () => {
      clearTimeout(timer);
      editor.off('update', onEditorUpdate);
    };
  }, [editor, showMore]);

  if (!editor) return null;

  const setFontSize = (size) => {
    if (!size) {
      editor.chain().focus().unsetFontSize().run();
      return;
    }
    editor.chain().focus().setFontSize(size).run();
  };

  const onImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => editor.chain().focus().setImage({ src: ev.target?.result }).run();
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const currentFontFamily =
    editor.getAttributes('textStyle').fontFamily || '';
  const currentFontSize =
    editor.getAttributes('textStyle').fontSize || '';
  const currentColor =
    editor.getAttributes('textStyle').color || '';

  return (
    <div className={`rte-wrapper ${fill ? 'rte-wrapper--fill' : ''}`.trim()}>
      <BubbleMenu
        editor={editor}
        className="rte-bubble"
      >
        <button
          type="button"
          className={`rte-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (Ctrl+B)"
        ><b>B</b></button>
        <button
          type="button"
          className={`rte-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (Ctrl+I)"
        ><i>I</i></button>
        <button
          type="button"
          className={`rte-btn ${editor.isActive('underline') ? 'is-active' : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline (Ctrl+U)"
        ><u>U</u></button>
        <button
          type="button"
          className={`rte-btn ${editor.isActive('strike') ? 'is-active' : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        ><s>S</s></button>
        <button
          type="button"
          className={`rte-btn ${editor.isActive('highlight') ? 'is-active' : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          title="Highlight"
        >🖍</button>
        <button
          type="button"
          className={`rte-btn ${editor.isActive('link') ? 'is-active' : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const prev = editor.getAttributes('link').href || '';
            const url = window.prompt('Link URL (leave blank to remove):', prev);
            if (url === null) return;
            if (url === '') {
              editor.chain().focus().extendMarkRange('link').unsetLink().run();
            } else {
              editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            }
          }}
          title="Link"
        >🔗</button>
      </BubbleMenu>

      <div className="rte-toolbar" role="toolbar" aria-label="Formatting">
        <div className="rte-group">
          <button
            type="button"
            className={`rte-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold (Ctrl+B)"
          ><b>B</b></button>
          <button
            type="button"
            className={`rte-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic (Ctrl+I)"
          ><i>I</i></button>
          <button
            type="button"
            className={`rte-btn ${editor.isActive('underline') ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline (Ctrl+U)"
          ><u>U</u></button>
        </div>

        <div className="rte-group">
          <select
            className="rte-select"
            value={
              editor.isActive('heading', { level: 1 }) ? 'h1'
                : editor.isActive('heading', { level: 2 }) ? 'h2'
                  : editor.isActive('heading', { level: 3 }) ? 'h3'
                    : 'p'
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'p') editor.chain().focus().setParagraph().run();
              else editor.chain().focus().toggleHeading({ level: Number(v.slice(1)) }).run();
            }}
            title="Paragraph style"
          >
            <option value="p">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>
        </div>

        <div className="rte-group">
          <button
            type="button"
            className={`rte-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet list"
          >•</button>
          <button
            type="button"
            className={`rte-btn ${editor.isActive('orderedList') ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered list"
          >1.</button>
          <button
            type="button"
            className={`rte-btn ${editor.isActive('blockquote') ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Quote"
          >❝</button>
          <button
            type="button"
            className={`rte-btn ${editor.isActive('codeBlock') ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="Code block"
          >{'</>'}</button>
        </div>

        <div className="rte-group">
          <button
            type="button"
            className={`rte-btn ${editor.isActive('link') ? 'is-active' : ''}`}
            onClick={() => {
              const prev = editor.getAttributes('link').href || '';
              const url = window.prompt('Link URL (leave blank to remove):', prev);
              if (url === null) return;
              if (url === '') {
                editor.chain().focus().extendMarkRange('link').unsetLink().run();
              } else {
                editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
              }
            }}
            title="Link"
          >🔗</button>
          <button
            type="button"
            className="rte-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Insert image"
          >🖼</button>
          <button
            type="button"
            className="rte-btn"
            onClick={() => {
              const { fixed, fixes } = analyzeHtmlLinks(editor.getHTML());
              setLinkPrompt({ fixes, fixedHtml: fixed });
            }}
            title="Scan & fix malformed links"
          >🩹</button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={onImageFile}
          />
        </div>

        <div className="rte-group">
          <button
            type="button"
            className="rte-btn"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo"
          >↶</button>
          <button
            type="button"
            className="rte-btn"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo"
          >↷</button>
        </div>

        <div className="rte-group rte-paste-mode" title="How pasted content is interpreted">
          {['auto', 'rich', 'markdown'].map(m => (
            <button
              key={m}
              type="button"
              className={`rte-btn rte-btn-text ${pasteMode === m ? 'is-active' : ''}`}
              onClick={() => setPasteMode(m)}
              title={
                m === 'auto' ? 'Paste: auto-detect Markdown, otherwise keep rich formatting'
                  : m === 'rich' ? 'Paste: keep source rich formatting'
                    : 'Paste: parse pasted text as Markdown'
              }
            >{m === 'auto' ? 'Auto' : m === 'rich' ? 'Rich' : 'MD'}</button>
          ))}
        </div>

        <div className="rte-group rte-group--end">
          <button
            type="button"
            className={`rte-btn ${showMore ? 'is-active' : ''} ${copilotBlocks && !showMore ? 'has-pending' : ''}`.trim()}
            onClick={() => setShowMore(v => !v)}
            title={copilotBlocks && !showMore ? 'More formatting — Copilot code blocks ready to render' : 'More formatting'}
            aria-expanded={showMore}
          >⋯</button>
        </div>
      </div>

      {showMore && (
        <div className="rte-toolbar rte-toolbar--more" role="toolbar" aria-label="More formatting">
          <div className="rte-group">
            <button
              type="button"
              className={`rte-btn ${editor.isActive('strike') ? 'is-active' : ''}`}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              title="Strikethrough"
            ><s>S</s></button>
            <button
              type="button"
              className={`rte-btn ${editor.isActive('highlight') ? 'is-active' : ''}`}
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              title="Highlight"
            >🖍</button>
          </div>

          <div className="rte-group">
            <button
              type="button"
              className="rte-btn rte-btn-text"
              onClick={renderCopilotBlocks}
              disabled={!copilotBlocks}
              title="Turn the just-pasted Copilot answer's code lines into real code blocks (available right after pasting)"
            >
              {copilotBlocks
                ? `Render ${copilotBlocks.count} code block${copilotBlocks.count === 1 ? '' : 's'}`
                : 'Render code blocks'}
            </button>
            <button
              type="button"
              className="rte-btn rte-btn-text"
              onClick={fixBrokenCodeBlocks}
              disabled={brokenCodeCount === 0}
              title="Repair Copilot 'Plain Text' code blocks that pasted as garbled inline code"
            >
              {brokenCodeCount > 0
                ? `Fix ${brokenCodeCount} broken code block${brokenCodeCount === 1 ? '' : 's'}`
                : 'Fix broken code blocks'}
            </button>
            <button
              type="button"
              className="rte-btn rte-btn-text"
              onClick={convertCardImages}
              disabled={cardImageCount === 0}
              title="Replace pasted Markdown-card screenshots with Markdown code blocks"
            >
              {cardImageCount > 0
                ? `Convert ${cardImageCount} image${cardImageCount === 1 ? '' : 's'} to Markdown`
                : 'Convert images to Markdown'}
            </button>
          </div>

          <div className="rte-group">
            <select
              className="rte-select"
              value={currentFontFamily}
              onChange={(e) => {
                const v = e.target.value;
                if (v) editor.chain().focus().setFontFamily(v).run();
                else editor.chain().focus().unsetFontFamily().run();
              }}
              title="Font Family"
            >
              {FONT_FAMILIES.map(f => (
                <option key={f.label} value={f.value} style={{ fontFamily: f.value || undefined }}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              className="rte-select"
              value={currentFontSize}
              onChange={(e) => setFontSize(e.target.value)}
              title="Font Size"
            >
              {FONT_SIZES.map(s => (
                <option key={s.label} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="rte-group rte-color-group">
            <label className="rte-color-label" title="Text color">
              <span style={{ color: currentColor || 'inherit' }}>A</span>
              <input
                type="color"
                className="rte-color-input"
                value={currentColor || '#000000'}
                onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
              />
            </label>
            <div className="rte-color-swatches">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className="rte-swatch"
                  style={{ background: c }}
                  title={c}
                  onClick={() => editor.chain().focus().setColor(c).run()}
                />
              ))}
              <button
                type="button"
                className="rte-btn rte-btn-text"
                onClick={() => editor.chain().focus().unsetColor().run()}
                title="Clear color"
              >✕</button>
            </div>
          </div>

          <div className="rte-group">
            <button
              type="button"
              className={`rte-btn ${editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}`}
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              title="Align left"
            >⯇</button>
            <button
              type="button"
              className={`rte-btn ${editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}`}
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              title="Align center"
            >≡</button>
            <button
              type="button"
              className={`rte-btn ${editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''}`}
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              title="Align right"
            >⯈</button>
          </div>

          <div className="rte-group">
            <button
              type="button"
              className="rte-btn"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="Divider"
            >―</button>
            <button
              type="button"
              className="rte-btn"
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              title="Insert table"
            >⊞</button>
          </div>

          <div className="rte-group">
            <button
              type="button"
              className="rte-btn"
              onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
              title="Clear formatting"
            >⎚</button>
          </div>
        </div>
      )}

      <EditorContent editor={editor} className="rte-editor" />

      {linkPrompt && (
        <LinkFixPrompt
          fixes={linkPrompt.fixes}
          onFix={() => {
            editor.commands.setContent(linkPrompt.fixedHtml);
            setLinkPrompt(null);
          }}
          onClose={() => setLinkPrompt(null)}
        />
      )}
    </div>
  );
}
