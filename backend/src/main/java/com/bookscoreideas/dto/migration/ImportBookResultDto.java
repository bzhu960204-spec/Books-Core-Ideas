package com.bookscoreideas.dto.migration;

// status: IMPORTED | SKIPPED_CONFLICT | FAILED
public record ImportBookResultDto(
        String title,
        String author,
        String status,
        String message,
        int chaptersImported,
        int imagesImported
) {}
