package com.bookscoreideas.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of part create/update; an id in the JSON is ignored (BUG-13). */
public record PartRequest(
        @NotBlank @Size(max = 255) String title,
        Integer orderIndex,
        @Size(max = 1000) String summary) {
}
