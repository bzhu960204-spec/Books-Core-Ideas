package com.bookscoreideas.dto.migration;

public record ImportPreviewEntryDto(
        String title,
        String author,
        int chapterCount,
        int imageCount,
        boolean hasExplanations,
        boolean conflict
) {}
