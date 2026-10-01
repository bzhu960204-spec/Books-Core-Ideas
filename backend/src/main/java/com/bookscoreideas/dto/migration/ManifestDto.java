package com.bookscoreideas.dto.migration;

import java.util.List;

// Top-level index of a migration archive (manifest.json).
public record ManifestDto(
        int formatVersion,
        String exportedAt,
        List<ManifestEntryDto> books
) {}
