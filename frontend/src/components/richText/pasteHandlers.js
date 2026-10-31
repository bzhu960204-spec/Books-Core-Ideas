// ProseMirror paste / drop handling for RichTextEditor. Every clipboard path is
// sanitized before it is inspected or inserted (SEC-01).
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import { looksLikeMarkdown, markdownToHtml } from '../../utils/markdownPaste';
import { dropOversizeImages, readImageFiles, stripPastedTextStyles, tagMarkdownCards, transformCopilotCodeBlocks } from './pasteTransforms';

/**
 * editorProps.handlePaste. `mode` is the toolbar's paste mode ('auto' | 'rich' |
 * 'markdown'). A native (HTML) paste holding Copilot pseudo-code blocks reports
 * `{ from, html, count }` to `onCopilotBlocks` so they can be rendered later.
 * Returns true when the paste was handled here.
 */
export function handlePaste(view, event, { editor, mode, onCopilotBlocks }) {
  const text = event.clipboardData?.getData('text/plain') ?? '';
  // Clipboard HTML is untrusted (AI answers, web pages): sanitize before
  // any of the paths below inspect or insert it.
  const html = stripPastedTextStyles(sanitizeHtml(event.clipboardData?.getData('text/html') ?? ''));

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
    editor.chain().focus().insertContent(sanitizeHtml(markdownToHtml(text))).run();
    return true;
  };

  // Arm the "Render code blocks" button for native (HTML) pastes only.
  const recordCopilot = () => {
    const { count } = transformCopilotCodeBlocks(richHtml);
    if (count > 0) onCopilotBlocks({ from: view.state.selection.from, html: richHtml, count });
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
}

/** editorProps.handleDrop: dropped image files are inserted where they land. */
export function handleDrop(view, event, editor) {
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
}

// Native pastes (handlePaste returned false) reach ProseMirror's own parser
// with the raw clipboard HTML, so sanitize here too.
export const transformPastedHTML = html => dropOversizeImages(stripPastedTextStyles(sanitizeHtml(html)));
