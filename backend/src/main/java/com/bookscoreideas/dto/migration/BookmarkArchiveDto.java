package com.bookscoreideas.dto.migration;

// A reading bookmark on the chapter's explanation (format v2). createdAt: ISO date-time;
// it orders the reading-history timeline, so it is kept as is.
public record BookmarkArchiveDto(
        Double scrollRatio,
        String note,
        String createdAt
) {}