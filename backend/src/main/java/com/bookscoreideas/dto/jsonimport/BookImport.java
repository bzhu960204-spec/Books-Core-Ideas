package com.bookscoreideas.dto.jsonimport;

import com.bookscoreideas.dto.BookValues;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

/**
 * A book to import: the fields of {@code CreateBookRequest} plus its structure. It is a
 * PARTS book when it has {@code parts} or says so in {@code structureType}; top-level
 * {@code chapters} of a PARTS book are imported ungrouped.
 */
public record BookImport(
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
        @Pattern(regexp = BookValues.STRUCTURE_TYPE, message = BookValues.STRUCTURE_TYPE_MESSAGE) String structureType,
        List<@Valid PartImport> parts,
        List<@Valid ChapterImport> chapters) {

    public boolean isPartsBook() {
        return parts != null || "PARTS".equals(structureType);
    }
}
