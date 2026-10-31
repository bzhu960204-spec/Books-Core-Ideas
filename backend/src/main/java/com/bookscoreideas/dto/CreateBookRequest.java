package com.bookscoreideas.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

/**
 * Body of {@code POST /api/books}. Only client-editable fields: an {@code id} or
 * nested {@code chapters} in the JSON are ignored, so a create can never merge
 * into an existing book (BUG-09). {@code dateAdded} is accepted so imported books
 * keep their original date; it defaults to today when absent.
 */
public record CreateBookRequest(
        @NotBlank String title,
        String author,
        String isbn,
        String description,
        String coverUrl,
        LocalDate dateAdded,
        Integer rating,
        String category,
        String readingStatus,
        LocalDate startDate,
        LocalDate finishDate,
        Boolean chapterImagesEnabled,
        String structureType) {
}
