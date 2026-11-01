package com.bookscoreideas.dto.migration;

// A book review (format v2). updatedAt: ISO date-time; an ISO date (archives
// before DB-06) is read as the start of that day.
public record ReviewArchiveDto(
        String title,
        String content,
        String updatedAt
) {}