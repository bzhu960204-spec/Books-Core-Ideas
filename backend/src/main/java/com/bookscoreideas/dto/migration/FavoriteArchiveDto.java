package com.bookscoreideas.dto.migration;

// The chapter is a favorite (V12). Absent (null) when it is not, and in archives
// written before favorites existed. createdAt: ISO date-time.
public record FavoriteArchiveDto(
        String note,
        String createdAt
) {}
