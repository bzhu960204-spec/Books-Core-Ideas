package com.bookscoreideas.dto.jsonimport;

/** Allowed values of an import's {@code mode}; null means ADD. */
public final class ImportMode {

    public static final String PATTERN = "ADD|REPLACE";
    public static final String MESSAGE = "must be ADD or REPLACE";

    private ImportMode() {
    }

    public static boolean isReplace(String mode) {
        return "REPLACE".equals(mode);
    }
}
