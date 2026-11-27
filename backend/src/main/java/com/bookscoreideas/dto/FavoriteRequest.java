package com.bookscoreideas.dto;

import jakarta.validation.constraints.Size;

/**
 * Body of PUT /api/chapters/{id}/favorite (optional). A null note leaves the note as
 * it is (so starring again keeps it); any other value replaces it, blank clears it.
 */
public record FavoriteRequest(
        @Size(max = 500) String note) {
}
