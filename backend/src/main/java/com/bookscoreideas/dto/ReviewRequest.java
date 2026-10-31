package com.bookscoreideas.dto;

import jakarta.validation.constraints.Size;

/**
 * Body of review create/update. On update a null field is left unchanged (the UI
 * always sends both); on create it is stored as empty.
 */
public record ReviewRequest(
        @Size(max = 255) String title,
        String content) {
}