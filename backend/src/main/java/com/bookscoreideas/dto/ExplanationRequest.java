package com.bookscoreideas.dto;

import jakarta.validation.constraints.Size;

/** Body of the chapter-explanation upsert; a missing content is stored as empty. */
public record ExplanationRequest(
        @Size(max = RichTextLimits.MAX_CHARS, message = RichTextLimits.MAX_CHARS_MESSAGE) String content) {
}