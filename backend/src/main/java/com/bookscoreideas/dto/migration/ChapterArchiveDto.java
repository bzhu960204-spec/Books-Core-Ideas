package com.bookscoreideas.dto.migration;

import java.util.List;

// bookmarks and marks were added in format v2 (null in v1 archives).
public record ChapterArchiveDto(
        String title,
        Integer orderIndex,
        String summary,
        ExplanationArchiveDto explanation,
        List<KeyIdeaArchiveDto> keyIdeas,
        List<ExcerptArchiveDto> excerpts,
        List<ImageArchiveDto> images,
        List<BookmarkArchiveDto> bookmarks,
        List<MarkArchiveDto> marks
) {}
