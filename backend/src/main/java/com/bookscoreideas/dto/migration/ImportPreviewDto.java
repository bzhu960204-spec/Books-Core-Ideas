package com.bookscoreideas.dto.migration;

import java.util.List;

public record ImportPreviewDto(
        int formatVersion,
        int totalBooks,
        int conflicts,
        List<ImportPreviewEntryDto> books
) {}
