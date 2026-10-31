package com.bookscoreideas.dto;

import jakarta.validation.constraints.NotBlank;

/** Body of chapter create/update; ids and nested ideas in the JSON are ignored (BUG-13). */
public record ChapterRequest(
        @NotBlank String title,
        Integer orderIndex,
        String summary,
        Long partId) {
}
