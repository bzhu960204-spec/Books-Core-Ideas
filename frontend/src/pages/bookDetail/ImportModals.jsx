import { importApi } from '../../api';
import { useRefresh } from '../../queries';
import { chapterContentImport, groupedContentImport, structureImport } from '../../utils/jsonImport';
import JsonImportModal from '../../components/JsonImportModal';
import {
  CHAPTERS_JSON_HINT, PARTS_JSON_HINT, IDEAS_JSON_HINT, EXCERPTS_JSON_HINT,
  CHAPTER_IDEAS_HINT, CHAPTER_EXCERPTS_HINT, CHAPTER_COMBINED_HINT,
} from './jsonImportHints';

// JSON import (FE-08): one server-side transaction per import; bodies from utils/jsonImport.

/** "Import JSON" of the whole book: its structure (chapters or parts), or ideas / excerpts by chapter title. */
export function BookImportModal({ bookId, isParts, onClose }) {
  const refresh = useRefresh();

  const handleStructureImport = async (parsed, mode) => {
    await importApi.structure(bookId, structureImport(parsed, mode, isParts));
    await refresh();
  };

  const handleGroupedImport = (kind) => async (parsed, mode) => {
    await importApi.content(bookId, groupedContentImport(parsed, mode, kind));
    await refresh();
  };

  return (
    <JsonImportModal
      title="Import JSON"
      tabs={[
        isParts
          ? { key: 'parts', label: 'Parts', placeholder: PARTS_JSON_HINT, onImport: handleStructureImport }
          : { key: 'chapters', label: 'Chapters', placeholder: CHAPTERS_JSON_HINT, onImport: handleStructureImport, addOnly: true },
        { key: 'ideas', label: 'Ideas (All)', placeholder: IDEAS_JSON_HINT, onImport: handleGroupedImport('ideas') },
        { key: 'excerpts', label: 'Excerpts (All)', placeholder: EXCERPTS_JSON_HINT, onImport: handleGroupedImport('excerpts') },
      ]}
      onClose={onClose}
    />
  );
}

/** The `{}` import of one chapter: its ideas, excerpts, or both. */
export function ChapterImportModal({ bookId, chapterId, chapterTitle, onClose }) {
  const refresh = useRefresh();

  const handleChapterImport = (kind) => async (parsed, mode) => {
    await importApi.content(bookId, chapterContentImport(parsed, mode, chapterId, kind));
    await refresh();
  };

  return (
    <JsonImportModal
      title={`Import — ${chapterTitle || 'Chapter'}`}
      tabs={[
        { key: 'ideas', label: 'Ideas', placeholder: CHAPTER_IDEAS_HINT, onImport: handleChapterImport('ideas') },
        { key: 'excerpts', label: 'Excerpts', placeholder: CHAPTER_EXCERPTS_HINT, onImport: handleChapterImport('excerpts') },
        { key: 'combined', label: 'Ideas + Excerpts', placeholder: CHAPTER_COMBINED_HINT, onImport: handleChapterImport('combined') },
      ]}
      onClose={onClose}
    />
  );
}
