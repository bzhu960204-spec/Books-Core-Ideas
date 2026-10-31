package com.bookscoreideas.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Body of {@code PUT /api/books/{id}}: replaces every editable field (an omitted
 * field is cleared), except that {@code dateAdded} is never changed and a null
 * {@code structureType} keeps the current structure.
 */
public record UpdateBookRequest(
        @NotBlank @Size(max = 255) String title,
        @Size(max = 255) String author,
        @Size(max = 255) String isbn,
        @Size(max = 2000) String description,
        @Size(max = 255) String coverUrl,
        @Min(1) @Max(5) Integer rating,
        @Size(max = 255) String category,
        @Pattern(regexp = BookValues.READING_STATUS, message = BookValues.READING_STATUS_MESSAGE) String readingStatus,
        LocalDate startDate,
        LocalDate finishDate,
        Boolean chapterImagesEnabled,
        @Pattern(regexp = BookValues.STRUCTURE_TYPE, message = BookValues.STRUCTURE_TYPE_MESSAGE) String structureType) {
}
