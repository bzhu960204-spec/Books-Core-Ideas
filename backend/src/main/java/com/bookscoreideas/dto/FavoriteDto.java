package com.bookscoreideas.dto;

import java.time.LocalDateTime;

/** A favorite chapter with the chapter and book it points at. */
public record FavoriteDto(
        Long id,
        Long chapterId,
        String chapterTitle,
        Integer chapterOrderIndex,
        String chapterSummary,
        boolean hasExplanation,
        Long bookId,
        String bookTitle,
        String bookAuthor,
        String bookCoverUrl,
        String note,
        String createdAt) {

    public static FavoriteDto of(Long id, Long chapterId, String chapterTitle, Integer chapterOrderIndex,
                                 String chapterSummary, boolean hasExplanation, Long bookId, String bookTitle,
                                 String bookAuthor, String bookCoverUrl, String note, LocalDateTime createdAt) {
        return new FavoriteDto(id, chapterId, chapterTitle, chapterOrderIndex, chapterSummary, hasExplanation,
                bookId, bookTitle, bookAuthor, bookCoverUrl,
                note != null ? note : "",
                createdAt != null ? createdAt.toString() : "");
    }
}
