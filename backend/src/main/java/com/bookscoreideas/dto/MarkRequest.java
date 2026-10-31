package com.bookscoreideas.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Body of a new saved passage. prefix/suffix (context to find the quote again) and
 * note are trimmed and cut to their column sizes by MarkService rather than rejected:
 * the context is captured from the page, so its length is not the reader's choice.
 */
public record MarkRequest(
        @NotBlank String quote,
        String prefix,
        String suffix,
        Integer startOffset,
        Integer endOffset,
        String note) {
}