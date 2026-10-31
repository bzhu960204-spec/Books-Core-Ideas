package com.bookscoreideas.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

/**
 * Body of {@code PUT /api/books/{id}}: replaces every editable field (an omitted
 * field is cleared), except that {@code dateAdded} is never changed and a null
 * {@code structureType} keeps the current structure.
 */
public record UpdateBookRequest(
        @NotBlank String title,
        String author,
        String isbn,
        String description,
        String coverUrl,
        Integer rating,
        String category,
        String readingStatus,
        LocalDate startDate,
        LocalDate finishDate,
        Boolean chapterImagesEnabled,
        String structureType) {
}
