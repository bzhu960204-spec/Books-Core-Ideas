package com.bookscoreideas.dto.migration;

import java.util.List;

// Request body for POST /api/migration/export. Empty/null bookIds = export all.
public record ExportRequestDto(
        List<Long> bookIds
) {}
