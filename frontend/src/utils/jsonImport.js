// Builds the bodies of the JSON import endpoints (FE-08) from what the user pasted.
// The server validates fields and imports each request in one transaction; here we
// only reshape the JSON and reject shapes the server cannot tell apart.

const asArray = (parsed) => (Array.isArray(parsed) ? parsed : [parsed]);
const apiMode = (mode) => (mode === 'replace' ? 'REPLACE' : 'ADD');

function requireObjects(items, what) {
  if (items.some(item => item === null || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error(`Each ${what} must be a JSON object.`);
  }
}

/** Library "Import JSON": a book or an array of books, with nested chapters / parts. */
export function bookImport(parsed) {
  const books = asArray(parsed);
  requireObjects(books, 'book');
  return { books };
}

/** Book page "Chapters" (flat books) or "Parts" tab. */
export function structureImport(parsed, mode, isPartsBook) {
  const items = asArray(parsed);
  requireObjects(items, isPartsBook ? 'part' : 'chapter');
  if (isPartsBook) return { mode: apiMode(mode), parts: items };
  // A chapter's nested "chapters" would be ignored by the server, so catch it here.
  if (items.some(item => Array.isArray(item.chapters))) {
    throw new Error('This looks like a Parts structure (objects contain a "chapters" array). This book uses the Chapters structure — switch the book to "Parts → Chapters" first, or import a flat chapters array.');
  }
  return { mode: apiMode(mode), chapters: items };
}

/** Book page "Ideas (All)" / "Excerpts (All)": groups named by chapter title. kind = 'ideas' | 'excerpts'. */
export function groupedContentImport(parsed, mode, kind) {
  const groups = asArray(parsed);
  requireObjects(groups, 'group');
  for (const group of groups) {
    if (!group.chapter) throw new Error('Each group must have a "chapter" field (chapter title).');
    if (!Array.isArray(group[kind]) || group[kind].length === 0) {
      throw new Error(`"${kind}" array is required for chapter "${group.chapter}".`);
    }
  }
  return { mode: apiMode(mode), chapters: groups.map(group => ({ chapter: group.chapter, [kind]: group[kind] })) };
}

/** A chapter's own import tabs. kind = 'ideas' | 'excerpts' (an array) or 'combined' ({ ideas, excerpts }). */
export function chapterContentImport(parsed, mode, chapterId, kind) {
  if (kind === 'combined') {
    const obj = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!obj || (!obj.ideas && !obj.excerpts)) throw new Error('Object must have an "ideas" and/or "excerpts" array.');
    return { mode: apiMode(mode), chapters: [{ chapterId, ideas: obj.ideas, excerpts: obj.excerpts }] };
  }
  const items = asArray(parsed);
  requireObjects(items, kind === 'ideas' ? 'idea' : 'excerpt');
  return { mode: apiMode(mode), chapters: [{ chapterId, [kind]: items }] };
}
