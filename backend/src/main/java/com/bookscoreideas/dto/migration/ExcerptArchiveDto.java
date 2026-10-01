package com.bookscoreideas.dto.migration;

public record ExcerptArchiveDto(
        String content,
        String note,
        String source,
        boolean highlighted,
        Integer orderIndex
) {}
