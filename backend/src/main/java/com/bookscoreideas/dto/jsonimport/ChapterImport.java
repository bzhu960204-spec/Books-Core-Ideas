package com.bookscoreideas.dto.jsonimport;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** A chapter to import (same limits as creating it directly). */
public record ChapterImport(
        @NotBlank @Size(max = 255) String title,
        Integer orderIndex,
        String summary) {
}
