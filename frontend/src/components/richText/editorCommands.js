// Toolbar commands shared by the selection bubble menu and the toolbars.

/** Asks for a URL and links the selection to it; a blank answer removes the link. */
export function promptForLink(editor) {
  const prev = editor.getAttributes('link').href || '';
  const url = window.prompt('Link URL (leave blank to remove):', prev);
  if (url === null) return;
  if (url === '') {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
  } else {
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }
}
