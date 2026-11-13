package com.bookscoreideas.dto;

import com.bookscoreideas.entity.Book;
import com.bookscoreideas.entity.Chapter;
import com.bookscoreideas.entity.ExplanationMark;

import java.time.LocalDateTime;

/** A passage saved from a chapter explanation, with its locating context. */
public record MarkDto(
        Long id,
        Long bookId,
        String bookTitle,
        Long chapterId,
        String chapterTitle,
        Integer chapterOrderIndex,
        String quote,
        String prefix,
        String suffix,
        Integer startOffset,
        Integer endOffset,
        String note,
        boolean orphaned,
        String createdAt,
        String updatedAt) {

    public static MarkDto from(ExplanationMark mark) {
        Chapter chapter = mark.getChapter();
        Book book = mark.getBook();
        return of(mark.getId(),
                book != null ? book.getId() : null,
                book != null ? book.getTitle() : "",
                chapter != null ? chapter.getId() : null,
                chapter != null ? chapter.getTitle() : "",
                chapter != null ? chapter.getOrderIndex() : null,
                mark.getQuote(), mark.getPrefix(), mark.getSuffix(), mark.getStartOffset(), mark.getEndOffset(),
                mark.getNote(), mark.isOrphaned(), mark.getCreatedAt(), mark.getUpdatedAt());
    }

    public static MarkDto of(Long id, Long bookId, String bookTitle, Long chapterId, String chapterTitle,
                             Integer chapterOrderIndex, String quote, String prefix, String suffix,
                             Integer startOffset, Integer endOffset, String note, boolean orphaned,
                             LocalDateTime createdAt, LocalDateTime updatedAt) {
        return new MarkDto(id, bookId, bookTitle, chapterId, chapterTitle, chapterOrderIndex,
                orEmpty(quote), orEmpty(prefix), orEmpty(suffix), startOffset, endOffset, orEmpty(note), orphaned,
                createdAt != null ? createdAt.toString() : "",
                updatedAt != null ? updatedAt.toString() : "");
    }

    private static String orEmpty(String value) {
        return value != null ? value : "";
    }
}
