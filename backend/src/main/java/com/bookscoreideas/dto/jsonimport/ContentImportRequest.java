package com.bookscoreideas.dto.jsonimport;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;

import java.util.List;

/**
 * Body of {@code POST /api/books/{id}/import/content}: key ideas and/or excerpts for
 * existing chapters of the book. With {@code mode} REPLACE, each named chapter's ideas
 * (if {@code ideas} is given) and excerpts (if {@code excerpts} is given) are deleted
 * first; other chapters and the other kind are untouched.
 */
public record ContentImportRequest(
        @Pattern(regexp = ImportMode.PATTERN, message = ImportMode.MESSAGE) String mode,
        @NotEmpty @Valid List<ChapterContentImport> chapters) {
}
