package com.bookscoreideas.dto.migration;

// One book entry inside the manifest, pointing at its book.json.
public record ManifestEntryDto(
        String slug,
        String title,
        String author,
        String path,
        int chapterCount,
        int imageCount
) {}
