package com.bookscoreideas.dto;

import java.util.List;

/** A chapter on the book page: its ideas and excerpts, and what else it has (FE-03). */
public record ChapterDetailDto(
        Long id,
        String title,
        Integer orderIndex,
        String summary,
        Long partId,
        List<KeyIdeaDto> keyIdeas,
        List<ExcerptDto> excerpts,
        long imageCount,
        boolean hasExplanation) {
}
