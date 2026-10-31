import { COLORS, FONT_FAMILIES, FONT_SIZES } from './fontOptions';

// Secondary toolbar row (collapsed by default to keep the editing surface tall):
// more marks, the Copilot code-block repairs, fonts, colors, alignment, inserts.
// Allowed to wrap since it holds many controls.
export default function MoreToolbar({
  editor,
  offer,
  brokenCodeCount,
  cardImageCount,
  onRenderOffer,
  onFixBroken,
  onConvertCards,
}) {
  const setFontSize = (size) => {
    if (!size) {
      editor.chain().focus().unsetFontSize().run();
      return;
    }
    editor.chain().focus().setFontSize(size).run();
  };

  const currentFontFamily =
    editor.getAttributes('textStyle').fontFamily || '';
  const currentFontSize =
    editor.getAttributes('textStyle').fontSize || '';
  const currentColor =
    editor.getAttributes('textStyle').color || '';

  return (
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
          onClick={onRenderOffer}
          disabled={!offer}
          title="Turn the just-pasted Copilot answer's code lines into real code blocks (available right after pasting)"
        >
          {offer
            ? `Render ${offer.count} code block${offer.count === 1 ? '' : 's'}`
            : 'Render code blocks'}
        </button>
        <button
          type="button"
          className="rte-btn rte-btn-text"
          onClick={onFixBroken}
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
          onClick={onConvertCards}
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
  );
}
