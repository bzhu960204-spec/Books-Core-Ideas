import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableHeader, TableCell } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import LinkFixPrompt from './LinkFixPrompt';
import { analyzeHtmlLinks } from '../utils/linkFix';
import { normalizeReviewContent } from '../utils/reviewContent';
import { FontSize, ResizableImage, SpanTextStyle } from './richText/extensions';
import { handleDrop, handlePaste, transformPastedHTML } from './richText/pasteHandlers';
import { useCodeBlockRepairs, useRepairCounts } from './richText/useCodeBlockRepairs';
import SelectionBubbleMenu from './richText/SelectionBubbleMenu';
import EditorToolbar from './richText/EditorToolbar';
import MoreToolbar from './richText/MoreToolbar';

// TipTap editor for reviews and chapter explanations. The pieces live in
// ./richText: extensions, paste handling (pure transforms + handlers), the
// Copilot code-block repairs, and the toolbars.
export default function RichTextEditor({ value, onChange, placeholder, autoFocus = false, fill = false }) {
  const [initialHtml] = useState(() => normalizeReviewContent(value));

  // How pasted content is interpreted: auto-detect Markdown, keep rich HTML, or
  // always parse plain text as Markdown. A ref mirrors it for the paste handler.
  const [pasteMode, setPasteMode] = useState('auto');
  const pasteModeRef = useRef('auto');

  // Secondary toolbar (fonts, colors, alignment, etc.) is collapsed by default
  // to keep the editing surface tall; core actions live in the compact row.
  const [showMore, setShowMore] = useState(false);

  // Pending malformed-link prompt from the "scan & fix" button: { fixes, fixedHtml }.
  const [linkPrompt, setLinkPrompt] = useState(null);

  const repairs = useCodeBlockRepairs();

  // Editor callbacks are created once, so they read the latest state via refs.
  useLayoutEffect(() => {
    pasteModeRef.current = pasteMode;
  }, [pasteMode]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Don't silently rewrite content on paste/type; links are applied only
        // via the toolbar or the explicit "scan & fix" action.
        link: { autolink: false, linkOnPaste: false },
      }),
      // FontFamily, FontSize and Color style the textStyle mark, which StarterKit v3
      // does not include (BUG-16); pasted colours, sizes and fonts are stripped.
      SpanTextStyle,
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
    content: initialHtml,
    autofocus: autoFocus,
    onUpdate: ({ editor }) => {
      repairs.onEditorUpdate(editor);
      const html = editor.getHTML();
      // TipTap emits "<p></p>" for empty content — normalize to empty string.
      onChange?.(html === '<p></p>' ? '' : html);
    },
    editorProps: {
      attributes: {
        class: 'rte-content',
        'data-placeholder': placeholder || '',
      },
      handlePaste: (view, event) =>
        handlePaste(view, event, { editor, mode: pasteModeRef.current, onCopilotBlocks: repairs.armOffer }),
      handleDrop: (view, event) => handleDrop(view, event, editor),
      transformPastedHTML,
    },
  });

  // Sync external value changes (e.g. when switching which review is being edited)
  useEffect(() => {
    if (!editor) return;
    const incoming = normalizeReviewContent(value);
    if (incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming || '', { emitUpdate: false });
    }
  }, [value, editor]);

  const { brokenCodeCount, cardImageCount } = useRepairCounts(editor, showMore);

  if (!editor) return null;

  const scanLinks = () => {
    const { fixed, fixes } = analyzeHtmlLinks(editor.getHTML());
    setLinkPrompt({ fixes, fixedHtml: fixed });
  };

  return (
    <div className={`rte-wrapper ${fill ? 'rte-wrapper--fill' : ''}`.trim()}>
      <SelectionBubbleMenu editor={editor} />

      <EditorToolbar
        editor={editor}
        pasteMode={pasteMode}
        onPasteModeChange={setPasteMode}
        showMore={showMore}
        onToggleMore={() => setShowMore(v => !v)}
        hasOffer={!!repairs.offer}
        onScanLinks={scanLinks}
      />

      {showMore && (
        <MoreToolbar
          editor={editor}
          offer={repairs.offer}
          brokenCodeCount={brokenCodeCount}
          cardImageCount={cardImageCount}
          onRenderOffer={() => repairs.renderOffer(editor)}
          onFixBroken={() => repairs.fixBroken(editor)}
          onConvertCards={() => repairs.convertCards(editor)}
        />
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
