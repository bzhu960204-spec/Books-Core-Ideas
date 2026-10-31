package com.bookscoreideas.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of chapter create/update; ids and nested ideas in the JSON are ignored (BUG-13). */
public record ChapterRequest(
        @NotBlank @Size(max = 255) String title,
        Integer orderIndex,
        String summary,
        Long partId) {
}
