package com.bookscoreideas.dto;

/** Body of a saved passage's note edit; null or blank clears the note. */
public record MarkNoteRequest(String note) {
}