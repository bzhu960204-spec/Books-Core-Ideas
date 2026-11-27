import { useRef, useState } from 'react';
import NoteMarkdown from './NoteMarkdown';
import { noteTextFromClipboard } from '../../utils/htmlToMarkdown';

// Plain Markdown textarea for a note, with an optional Write / Preview switch.
// Pasting rendered rich text (e.g. an AI answer copied from a web page) inserts
// it as Markdown so its structure is kept instead of collapsing to one line.
export default function NoteEditor({
  value,
  onChange,
  maxLength,
  inputRef,
  preview = true,
  ...textareaProps
}) {
  const [mode, setMode] = useState('write');
  const ownRef = useRef(null);
  const ref = inputRef || ownRef;

  const onPaste = (e) => {
    const markdown = noteTextFromClipboard(e.clipboardData);
    if (markdown == null) return;
    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    let insert = markdown;
    if (maxLength) insert = insert.slice(0, Math.max(0, maxLength - (value.length - (end - start))));
    onChange(value.slice(0, start) + insert + value.slice(end));
    const caret = start + insert.length;
    requestAnimationFrame(() => ref.current?.setSelectionRange(caret, caret));
  };

  const tab = (name, label) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === name}
      className={`note-editor-tab${mode === name ? ' is-active' : ''}`}
      onClick={() => {
        setMode(name);
        if (name === 'write') requestAnimationFrame(() => ref.current?.focus());
      }}
    >{label}</button>
  );

  return (
    <div className="note-editor">
      {preview && (
        <div className="note-editor-bar">
          <div role="tablist" aria-label="Note view" className="note-editor-tabs">
            {tab('write', 'Write')}
            {tab('preview', 'Preview')}
          </div>
          <span className="note-editor-hint">Markdown and $math$ supported</span>
        </div>
      )}
      <textarea
        {...textareaProps}
        ref={ref}
        hidden={mode === 'preview'}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
      />
      {mode === 'preview' && (
        <div className="note-editor-preview">
          {value.trim()
            ? <NoteMarkdown>{value}</NoteMarkdown>
            : <span className="note-editor-empty">Nothing to preview</span>}
        </div>
      )}
    </div>
  );
}
