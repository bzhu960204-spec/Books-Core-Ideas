package com.bookscoreideas.dto.migration;

import java.util.List;

public record ImportResultDto(
        int booksImported,
        int booksSkipped,
        int booksFailed,
        List<ImportBookResultDto> details
) {}
