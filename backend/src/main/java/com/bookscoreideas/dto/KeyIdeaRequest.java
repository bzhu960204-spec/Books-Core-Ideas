package com.bookscoreideas.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of key-idea create/update; an id in the JSON is ignored (BUG-13). */
public record KeyIdeaRequest(
        @NotBlank @Size(max = 3000) String content,
        @Size(max = 3000) String example,
        @Size(max = 500) String tags,
        boolean highlighted,
        Integer orderIndex) {
}
