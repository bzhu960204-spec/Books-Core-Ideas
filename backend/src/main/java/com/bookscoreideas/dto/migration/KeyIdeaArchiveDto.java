package com.bookscoreideas.dto.migration;

public record KeyIdeaArchiveDto(
        String content,
        String example,
        String tags,
        boolean highlighted,
        Integer orderIndex
) {}
