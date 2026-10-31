package com.bookscoreideas.dto;

import java.util.List;

/**
 * Everything the book page shows, in one response (FE-03): the same data as
 * GET /books/{id}, /parts, /chapters, each chapter's /excerpts, image count and
 * explanation flag, /bookmarks?bookId (newest first) and /books/{id}/marks.
 */
public record BookDetailDto(
        BookDto book,
        List<PartDto> parts,
        List<ChapterDetailDto> chapters,
        List<BookmarkDto> bookmarks,
        List<MarkDto> marks) {
}
