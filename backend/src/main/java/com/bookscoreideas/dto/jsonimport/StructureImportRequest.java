package com.bookscoreideas.dto.jsonimport;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;

import java.util.List;

/**
 * Body of {@code POST /api/books/{id}/import}: parts and/or chapters to add to an
 * existing book. {@code mode} REPLACE first deletes all of the book's parts and
 * chapters (with everything they own); ADD (the default) keeps them.
 * A CHAPTERS book takes only {@code chapters}; in a PARTS book, top-level
 * {@code chapters} are added ungrouped.
 */
public record StructureImportRequest(
        @Pattern(regexp = ImportMode.PATTERN, message = ImportMode.MESSAGE) String mode,
        List<@Valid PartImport> parts,
        List<@Valid ChapterImport> chapters) {
}
