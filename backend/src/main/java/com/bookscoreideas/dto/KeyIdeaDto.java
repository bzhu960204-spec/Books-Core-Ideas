package com.bookscoreideas.dto;

import com.bookscoreideas.entity.KeyIdea;

public record KeyIdeaDto(
        Long id,
        String content,
        String example,
        String tags,
        boolean highlighted,
        Integer orderIndex) {

    public static KeyIdeaDto from(KeyIdea idea) {
        return new KeyIdeaDto(idea.getId(), idea.getContent(), idea.getExample(), idea.getTags(),
                idea.isHighlighted(), idea.getOrderIndex());
    }
}
