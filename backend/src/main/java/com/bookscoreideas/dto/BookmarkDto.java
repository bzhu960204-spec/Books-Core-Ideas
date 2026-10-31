package com.bookscoreideas.dto;

import com.bookscoreideas.entity.Book;
import com.bookscoreideas.entity.Chapter;
import com.bookscoreideas.entity.ReadingBookmark;

import java.time.LocalDateTime;

/** A reading-history bookmark with the chapter and book it points at. */
public record BookmarkDto(
        Long id,
        Long chapterId,
        String chapterTitle,
        Long bookId,
        String bookTitle,
        String bookAuthor,
        String bookCoverUrl,
        Double scrollRatio,
        String note,
        String createdAt) {

    public static BookmarkDto from(ReadingBookmark bookmark) {
        Chapter chapter = bookmark.getChapter();
        Book book = bookmark.getBook();
        return of(bookmark.getId(),
                chapter != null ? chapter.getId() : null,
                chapter != null ? chapter.getTitle() : "",
                book != null ? book.getId() : null,
                book != null ? book.getTitle() : "",
                book != null ? book.getAuthor() : "",
                book != null ? book.getCoverUrl() : null,
                bookmark.getScrollRatio(), bookmark.getNote(), bookmark.getCreatedAt());
    }

    public static BookmarkDto of(Long id, Long chapterId, String chapterTitle, Long bookId, String bookTitle,
                                 String bookAuthor, String bookCoverUrl, Double scrollRatio, String note,
                                 LocalDateTime createdAt) {
        return new BookmarkDto(id, chapterId, chapterTitle, bookId, bookTitle, bookAuthor, bookCoverUrl,
                scrollRatio,
                note != null ? note : "",
                createdAt != null ? createdAt.toString() : "");
    }
}
