package com.bookscoreideas.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * Body of "update where these passages stand after the explanation changed". Each entry
 * is either orphaned (its text is gone) or found, with its fresh anchor; fields left
 * out keep their stored value. A found entry with a quote re-links the passage to new text.
 */
public record MarkAnchorsRequest(@NotNull List<@NotNull @Valid Entry> marks) {

    public record Entry(
            @NotNull Long id,
            String quote,
            String prefix,
            String suffix,
            Integer startOffset,
            Integer endOffset,
            Boolean orphaned) {
    }
}
