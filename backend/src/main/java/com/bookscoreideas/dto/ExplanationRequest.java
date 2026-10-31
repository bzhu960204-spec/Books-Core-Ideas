package com.bookscoreideas.dto;

/** Body of the chapter-explanation upsert; a missing content is stored as empty. */
public record ExplanationRequest(String content) {
}