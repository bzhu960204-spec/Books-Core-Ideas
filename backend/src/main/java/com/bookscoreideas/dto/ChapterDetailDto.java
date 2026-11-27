package com.bookscoreideas.dto;

/** A chapter on the book page and what else it has (FE-03); whether it is a favorite. */
public record ChapterDetailDto(
        Long id,
        String title,
        Integer orderIndex,
        String summary,
        Long partId,
        long imageCount,
        boolean hasExplanation,
        boolean favorite) {
}
