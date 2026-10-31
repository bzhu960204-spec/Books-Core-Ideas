import { useRef } from 'react';
import { promptForLink } from './editorCommands';

const PASTE_MODE_TITLES = {
  auto: 'Paste: auto-detect Markdown, otherwise keep rich formatting',
  rich: 'Paste: keep source rich formatting',
  markdown: 'Paste: parse pasted text as Markdown',
};
const PASTE_MODE_LABELS = { auto: 'Auto', rich: 'Rich', markdown: 'MD' };

// The always-visible toolbar row: core formatting, insert, undo/redo, paste mode,
// and the "⋯" toggle for the secondary row (MoreToolbar).
export default function EditorToolbar({
  editor,
  pasteMode,
  onPasteModeChange,
  showMore,
  onToggleMore,
  hasOffer,
  onScanLinks,
}) {
  const fileInputRef = useRef(null);

  const onImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => editor.chain().focus().setImage({ src: ev.target?.result }).run();
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
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
          onClick={() => promptForLink(editor)}
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
          onClick={onScanLinks}
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
            onClick={() => onPasteModeChange(m)}
            title={PASTE_MODE_TITLES[m]}
          >{PASTE_MODE_LABELS[m]}</button>
        ))}
      </div>

      <div className="rte-group rte-group--end">
        <button
          type="button"
          className={`rte-btn ${showMore ? 'is-active' : ''} ${hasOffer && !showMore ? 'has-pending' : ''}`.trim()}
          onClick={onToggleMore}
          title={hasOffer && !showMore ? 'More formatting — Copilot code blocks ready to render' : 'More formatting'}
          aria-expanded={showMore}
        >⋯</button>
      </div>
    </div>
  );
}
