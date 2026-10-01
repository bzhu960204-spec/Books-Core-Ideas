package com.bookscoreideas.dto.migration;

import java.util.List;

// Full, self-contained snapshot of a single book (books/{slug}/book.json).
public record BookArchiveDto(
        int formatVersion,
        String title,
        String author,
        String isbn,
        String description,
        String coverUrl,
        Integer rating,
        String category,
        String readingStatus,
        String dateAdded,
        String startDate,
        String finishDate,
        Boolean chapterImagesEnabled,
        String structureType,
        List<PartArchiveDto> parts,
        List<ChapterArchiveDto> chapters
) {}
