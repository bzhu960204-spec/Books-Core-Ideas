package com.bookscoreideas.dto;

import jakarta.validation.constraints.NotBlank;

/** Body of part create/update; an id in the JSON is ignored (BUG-13). */
public record PartRequest(
        @NotBlank String title,
        Integer orderIndex,
        String summary) {
}
