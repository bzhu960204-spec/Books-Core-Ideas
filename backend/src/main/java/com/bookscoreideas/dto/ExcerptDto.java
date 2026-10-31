package com.bookscoreideas.dto;

import com.bookscoreideas.entity.Excerpt;

public record ExcerptDto(
        Long id,
        String content,
        String note,
        String source,
        Integer orderIndex,
        boolean highlighted) {

    public static ExcerptDto from(Excerpt excerpt) {
        return new ExcerptDto(excerpt.getId(), excerpt.getContent(), excerpt.getNote(), excerpt.getSource(),
                excerpt.getOrderIndex(), excerpt.isHighlighted());
    }
}
