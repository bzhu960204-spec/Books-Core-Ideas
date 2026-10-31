import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, useBookDetail } from '../../queries';

const NONE = [];

/**
 * Everything the book page shows, from one cached request (GET /books/{id}/detail),
 * plus helpers that change that cache at once for immediate feedback after a
 * write; refresh() then confirms it from the server.
 */
export function useBookDetailData(id) {
  const queryClient = useQueryClient();
  const detailQuery = useBookDetail(id);
  const detail = detailQuery.data;
  const book = detail?.book ?? null;
  const chapters = detail?.chapters ?? NONE;
  const bookmarks = detail?.bookmarks ?? NONE; // newest first

  const updateDetail = (change) =>
    queryClient.setQueryData(queryKeys.bookDetail(id), d => (d ? change(d) : d));
  const updateChapter = (chapterId, change) =>
    updateDetail(d => ({ ...d, chapters: d.chapters.map(c => (c.id === chapterId ? change(c) : c)) }));

  return {
    isPending: detailQuery.isPending,
    error: detailQuery.error,
    refetch: detailQuery.refetch,
    book,
    chapters,
    parts: book?.structureType === 'PARTS' ? detail.parts : NONE,
    marks: detail?.marks ?? NONE, // saved explanation passages for this book
    latestBookmark: bookmarks[0] ?? null, // drives "continue reading"
    bookmarkedChapterIds: Object.fromEntries(bookmarks.map(m => [m.chapterId, true])),
    chapterById: (chapterId) => chapters.find(c => c.id === chapterId),
    updateDetail,
    updateChapter,
  };
}
