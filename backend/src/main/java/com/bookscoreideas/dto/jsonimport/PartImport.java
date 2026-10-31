package com.bookscoreideas.dto.jsonimport;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/** A part to import, with its chapters (optional: bare parts are allowed). */
public record PartImport(
        @NotBlank @Size(max = 255) String title,
        Integer orderIndex,
        @Size(max = 1000) String summary,
        @Valid List<ChapterImport> chapters) {
}
