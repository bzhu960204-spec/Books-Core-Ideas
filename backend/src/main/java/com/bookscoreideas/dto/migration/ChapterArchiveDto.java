package com.bookscoreideas.dto.migration;

import java.util.List;

public record ChapterArchiveDto(
        String title,
        Integer orderIndex,
        String summary,
        ExplanationArchiveDto explanation,
        List<KeyIdeaArchiveDto> keyIdeas,
        List<ExcerptArchiveDto> excerpts,
        List<ImageArchiveDto> images
) {}
