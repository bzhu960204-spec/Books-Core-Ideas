package com.bookscoreideas.dto;

import jakarta.validation.constraints.NotBlank;

/** Body of key-idea create/update; an id in the JSON is ignored (BUG-13). */
public record KeyIdeaRequest(
        @NotBlank String content,
        String example,
        String tags,
        boolean highlighted,
        Integer orderIndex) {
}
