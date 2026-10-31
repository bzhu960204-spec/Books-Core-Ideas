package com.bookscoreideas.dto.jsonimport;

import com.bookscoreideas.dto.ExcerptRequest;
import com.bookscoreideas.dto.KeyIdeaRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/** A chapter to import with its key ideas and excerpts (same limits as creating them one by one). */
public record ChapterImport(
        @NotBlank @Size(max = 255) String title,
        Integer orderIndex,
        String summary,
        @Valid List<KeyIdeaRequest> keyIdeas,
        @Valid List<ExcerptRequest> excerpts) {
}
