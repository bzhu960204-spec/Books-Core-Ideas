package com.bookscoreideas.dto.jsonimport;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * Body of {@code POST /api/books/import}: one or more books in the JSON import format
 * (the shape produced by the book's "Export JSON"). All are created in one transaction:
 * if any is invalid, none is created.
 */
public record BookImportRequest(@NotEmpty @Valid List<BookImport> books) {
}
