package com.bookscoreideas.dto.migration;

import java.util.List;

// Full, self-contained snapshot of a single book (books/{slug}/book.json).
// Format v2 added reviews and collectionPaths (and bookmarks/marks per chapter);
// they are null when reading a v1 archive.
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
        List<ChapterArchiveDto> chapters,
        List<ReviewArchiveDto> reviews,
        // Collections containing the book, each as folder names from the root down,
        // e.g. [["Psychology", "Habits"]]; import finds or creates folders by path.
        List<List<String>> collectionPaths
) {}
