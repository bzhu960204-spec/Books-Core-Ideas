package com.bookscoreideas.dto.migration;

public record ImageArchiveDto(
        String filename,
        String originalName,
        String contentType,
        Integer orderIndex
) {}
