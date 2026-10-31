package com.bookscoreideas.dto;

import jakarta.validation.constraints.NotBlank;

/** Body of excerpt create/update; an id in the JSON is ignored (BUG-13). */
public record ExcerptRequest(
        @NotBlank String content,
        String note,
        String source,
        Integer orderIndex,
        boolean highlighted) {
}
