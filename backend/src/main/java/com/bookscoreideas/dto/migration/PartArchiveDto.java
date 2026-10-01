package com.bookscoreideas.dto.migration;

import java.util.List;

public record PartArchiveDto(
        String title,
        Integer orderIndex,
        String summary,
        List<ChapterArchiveDto> chapters
) {}
