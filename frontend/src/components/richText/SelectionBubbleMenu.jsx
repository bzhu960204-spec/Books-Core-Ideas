import { BubbleMenu } from '@tiptap/react/menus';
import { promptForLink } from './editorCommands';

// Compact inline formatting shown over a text selection. mouseDown is prevented
// so clicking a button keeps the selection.
export default function SelectionBubbleMenu({ editor }) {
  return (
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
        onClick={() => promptForLink(editor)}
        title="Link"
      >🔗</button>
    </BubbleMenu>
  );
}
