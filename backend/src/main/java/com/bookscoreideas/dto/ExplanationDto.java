package com.bookscoreideas.dto;

import com.bookscoreideas.entity.ChapterExplanation;

/** A chapter's explanation; absent text and date are sent as empty strings. */
public record ExplanationDto(Long id, Long chapterId, String content, String updatedAt) {

    public static ExplanationDto from(ChapterExplanation explanation) {
        return new ExplanationDto(
                explanation.getId(),
                explanation.getChapter() != null ? explanation.getChapter().getId() : null,
                explanation.getContent() != null ? explanation.getContent() : "",
                explanation.getUpdatedAt() != null ? explanation.getUpdatedAt().toString() : "");
    }
}
