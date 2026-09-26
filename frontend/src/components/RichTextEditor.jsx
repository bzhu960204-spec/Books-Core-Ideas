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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
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
      const html = editor.getHTML();
      // TipTap emits "<p></p>" for empty content — normalize to empty string.
      onChange?.(html === '<p></p>' ? '' : html);
    },
    editorProps: {
      attributes: {
        class: 'rte-content',
        'data-placeholder': placeholder || '',
      },
      handlePaste: (_view, event) => {
        // Paste an image file straight into the document as a data URL.
        const items = event.clipboardData?.items;
        if (items) {
          for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
              event.preventDefault();
              const file = item.getAsFile();
              if (!file) return true;
              const reader = new FileReader();
              reader.onload = (e) => editor?.chain().focus().setImage({ src: e.target?.result }).run();
              reader.readAsDataURL(file);
              return true;
            }
          }
        }

        const text = event.clipboardData?.getData('text/plain') ?? '';
        const mode = pasteModeRef.current;
        const insertAsMarkdown = () => {
          if (!editor || !text) return false;
          event.preventDefault();
          editor.chain().focus().insertContent(markdownToHtml(text)).run();
          return true;
        };

        if (mode === 'markdown') return insertAsMarkdown();
        if (mode === 'rich') return false;
        // auto: convert only when the text looks like Markdown source.
        if (text && looksLikeMarkdown(text)) return insertAsMarkdown();
        return false;
      },
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
            className={`rte-btn ${showMore ? 'is-active' : ''}`}
            onClick={() => setShowMore(v => !v)}
            title="More formatting"
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
    </div>
  );
}
