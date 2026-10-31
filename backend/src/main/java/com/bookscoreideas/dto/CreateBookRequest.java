package com.bookscoreideas.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Body of {@code POST /api/books}. Only client-editable fields: an {@code id} or
 * nested {@code chapters} in the JSON are ignored, so a create can never merge
 * into an existing book (BUG-09). {@code dateAdded} is accepted so imported books
 * keep their original date; it defaults to today when absent.
 */
public record CreateBookRequest(
        @NotBlank @Size(max = 255) String title,
        @Size(max = 255) String author,
        @Size(max = 255) String isbn,
        @Size(max = 2000) String description,
        @Size(max = 255) String coverUrl,
        LocalDate dateAdded,
        @Min(1) @Max(5) Integer rating,
        @Size(max = 255) String category,
        @Pattern(regexp = BookValues.READING_STATUS, message = BookValues.READING_STATUS_MESSAGE) String readingStatus,
        LocalDate startDate,
        LocalDate finishDate,
        Boolean chapterImagesEnabled,
        @Pattern(regexp = BookValues.STRUCTURE_TYPE, message = BookValues.STRUCTURE_TYPE_MESSAGE) String structureType) {
}
