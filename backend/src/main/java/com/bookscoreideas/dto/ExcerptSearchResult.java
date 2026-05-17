package com.bookscoreideas.dto;

public record ExcerptSearchResult(
        Long id,
        String content,
        String note,
        String source,
        Integer orderIndex,
        Long chapterId,
        String chapterTitle,
        Long bookId,
        String bookTitle,
        String bookAuthor
) {}
