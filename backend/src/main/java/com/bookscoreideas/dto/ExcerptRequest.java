package com.bookscoreideas.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of excerpt create/update; an id in the JSON is ignored (BUG-13). */
public record ExcerptRequest(
        @NotBlank String content,
        @Size(max = 1000) String note,
        @Size(max = 300) String source,
        Integer orderIndex,
        boolean highlighted) {
}
