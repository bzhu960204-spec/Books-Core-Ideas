package com.bookscoreideas.dto.migration;

import java.util.List;

// bookmarks and marks were added in format v2 (null in v1 archives). favorite is
// optional within v2: null when the chapter is not a favorite, and in older archives.
// Key ideas and excerpts in older archives are ignored (the features were removed).
public record ChapterArchiveDto(
        String title,
        Integer orderIndex,
        String summary,
        ExplanationArchiveDto explanation,
        List<ImageArchiveDto> images,
        List<BookmarkArchiveDto> bookmarks,
        List<MarkArchiveDto> marks,
        FavoriteArchiveDto favorite
) {}
