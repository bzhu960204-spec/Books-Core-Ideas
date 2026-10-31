package com.bookscoreideas.dto.migration;

// A book review (format v2). updatedAt: ISO date.
public record ReviewArchiveDto(
        String title,
        String content,
        String updatedAt
) {}