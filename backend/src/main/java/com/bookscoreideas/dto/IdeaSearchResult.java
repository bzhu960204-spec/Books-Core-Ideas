package com.bookscoreideas.dto;

public record IdeaSearchResult(
        Long id,
        String content,
        String example,
        String tags,
        Integer orderIndex,
        Long chapterId,
        String chapterTitle,
        Long bookId,
        String bookTitle,
        String bookAuthor
) {}
