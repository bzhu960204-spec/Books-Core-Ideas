package com.bookscoreideas.dto;

/** A file that was not saved, and why, in words the user can read (BUG-10, SEC-04). */
public record SkippedFile(String name, String reason) {
    public static final String EMPTY = "empty file";
    public static final String NOT_AN_IMAGE = "not a PNG, JPEG, GIF or WebP image";
    public static final String NOT_SAVED = "could not be saved";
    public static final String MISSING = "missing from the archive";
}
