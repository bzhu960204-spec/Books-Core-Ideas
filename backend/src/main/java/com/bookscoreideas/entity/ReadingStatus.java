package com.bookscoreideas.entity;

/** A book's reading status; a book without one has {@code null} (DB-06). */
public enum ReadingStatus {
    WANT_TO_READ,
    READING,
    FINISHED;

    /**
     * Parses the status as clients send it: {@code null} and {@code ""} (the form's
     * "Not set", JSON exports and archives from before DB-06) mean none.
     *
     * @throws IllegalArgumentException for any other unknown value
     */
    public static ReadingStatus fromText(String text) {
        return text == null || text.isEmpty() ? null : valueOf(text);
    }

    /** Like {@link #fromText}, but an unknown value also means none: for imported archives. */
    public static ReadingStatus fromTextOrNull(String text) {
        try {
            return fromText(text);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public static String text(ReadingStatus status) {
        return status != null ? status.name() : null;
    }
}
