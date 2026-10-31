// Data layer (FE-03): every read goes through TanStack Query, so pages share one
// cache (the book list is fetched once, not by five pages), requests are
// de-duplicated and cancelled, and a fast switch between books can't let an old
// response overwrite the new one. Writes still call api.js directly and then
// refresh(): all cached reads become stale, the ones on screen refetch at once,
// the others when they are next shown.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { QueryClient, keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookApi, bookCollectionApi, bookmarkApi, chapterImageApi, excerptBankApi, ideaBankApi, reviewApi } from './api';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Revisiting a page within 30 s shows the cache without a request;
        // writes made in this app invalidate it immediately anyway (refresh()).
        staleTime: 30_000,
        // A 4xx (e.g. a deleted book) won't succeed on retry; a network blip may.
        retry: (failureCount, error) => failureCount < 1 && !(error?.status >= 400 && error?.status < 500),
      },
    },
  });
}

export const queryKeys = {
  books: ['books'],
  categories: ['categories'],
  bookDetail: (id) => ['book', String(id), 'detail'],
  reviews: ['reviews'],
  bookmarks: ['bookmarks'],
  ideaSearch: (params) => ['ideas', params],
  excerptSearch: (params) => ['excerpts', params],
  chapterImages: (chapterId) => ['chapter', String(chapterId), 'images'],
  collections: ['collections'],
  collectionBooks: (id, includeDescendants) => ['collections', id, 'books', includeDescendants],
};

export const useBooks = () =>
  useQuery({ queryKey: queryKeys.books, queryFn: ({ signal }) => bookApi.getAll({ signal }) });

export const useCategories = () =>
  useQuery({ queryKey: queryKeys.categories, queryFn: ({ signal }) => bookApi.getCategories({ signal }) });

export const useBookDetail = (id) =>
  useQuery({ queryKey: queryKeys.bookDetail(id), queryFn: ({ signal }) => bookApi.detail(id, { signal }) });

export const useReviews = () =>
  useQuery({ queryKey: queryKeys.reviews, queryFn: ({ signal }) => reviewApi.getAll({ signal }) });

export const useBookmarks = () =>
  useQuery({ queryKey: queryKeys.bookmarks, queryFn: ({ signal }) => bookmarkApi.list(null, { signal }) });

// Searches keep showing the previous results while the next ones load.
export const useIdeaSearch = (params) =>
  useQuery({
    queryKey: queryKeys.ideaSearch(params),
    queryFn: ({ signal }) => ideaBankApi.search(params, { signal }),
    placeholderData: keepPreviousData,
  });

export const useExcerptSearch = (params) =>
  useQuery({
    queryKey: queryKeys.excerptSearch(params),
    queryFn: ({ signal }) => excerptBankApi.search(params, { signal }),
    placeholderData: keepPreviousData,
  });

export const useChapterImages = (chapterId) =>
  useQuery({
    queryKey: queryKeys.chapterImages(chapterId),
    queryFn: ({ signal }) => chapterImageApi.getAll(chapterId, { signal }),
  });

export const useCollections = () =>
  useQuery({ queryKey: queryKeys.collections, queryFn: ({ signal }) => bookCollectionApi.list({ signal }) });

export const useCollectionBooks = (id, includeDescendants) =>
  useQuery({
    queryKey: queryKeys.collectionBooks(id, includeDescendants),
    queryFn: ({ signal }) => bookCollectionApi.booksIn(id, includeDescendants, { signal }),
    enabled: id != null,
  });

/** After a write: mark every cached read stale and refetch the ones on screen (resolves when done). */
export function useRefresh() {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries(), [queryClient]);
}

/** `value` once it has stopped changing for `delayMs` (compared by JSON, so objects are fine). */
export function useDebouncedValue(value, delayMs) {
  const key = JSON.stringify(value);
  const [debounced, setDebounced] = useState(key);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(key), delayMs);
    return () => clearTimeout(timer);
  }, [key, delayMs]);
  return useMemo(() => JSON.parse(debounced), [debounced]);
}
