package com.bookscoreideas.dto.migration;

// A passage saved from the chapter's explanation (format v2). The offsets point into the
// explanation text, which travels in the same chapter entry. Timestamps: ISO date-time.
public record MarkArchiveDto(
        String quote,
        String prefix,
        String suffix,
        Integer startOffset,
        Integer endOffset,
        String note,
        String createdAt,
        String updatedAt
) {}