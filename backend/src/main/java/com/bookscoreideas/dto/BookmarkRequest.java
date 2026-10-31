package com.bookscoreideas.dto;

import jakarta.validation.constraints.Size;

/**
 * Body of a new reading bookmark. scrollRatio is the position in the explanation
 * reader (0..1, null if unknown); a blank note is stored as none.
 */
public record BookmarkRequest(
        Double scrollRatio,
        @Size(max = 500) String note) {
}