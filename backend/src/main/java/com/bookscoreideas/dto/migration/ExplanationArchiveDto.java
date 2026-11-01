package com.bookscoreideas.dto.migration;

// updatedAt: ISO date-time; an ISO date (archives before DB-06) is read as the start of that day.
public record ExplanationArchiveDto(
        String content,
        String updatedAt
) {}
