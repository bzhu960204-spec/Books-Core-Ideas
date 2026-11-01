package com.bookscoreideas.dto.jsonimport;

import com.bookscoreideas.dto.ExcerptRequest;
import com.bookscoreideas.dto.KeyIdeaRequest;
import jakarta.validation.Valid;

import java.util.List;

/**
 * Content for one chapter, named by {@code chapterId} or by {@code chapter} (its title:
 * an exact, case-insensitive match first, otherwise the first title containing it).
 */
public record ChapterContentImport(
        Long chapterId,
        String chapter,
        List<@Valid KeyIdeaRequest> ideas,
        List<@Valid ExcerptRequest> excerpts) {
}
