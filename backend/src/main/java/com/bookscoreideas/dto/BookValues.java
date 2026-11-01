package com.bookscoreideas.dto;

/**
 * Allowed values of the book's enum fields in requests, validated on every write
 * (BE-05). Requests keep them as strings: "" is still accepted for "no reading
 * status" (the book form, JSON exports and archives from before DB-06) and stored as
 * null; the entity maps them to {@code ReadingStatus} / {@code StructureType}.
 */
public final class BookValues {

    /** WANT_TO_READ, READING, FINISHED; "" (the form's "Not set") and null mean none. */
    public static final String READING_STATUS = "WANT_TO_READ|READING|FINISHED|";
    public static final String READING_STATUS_MESSAGE = "must be WANT_TO_READ, READING, FINISHED or empty";

    public static final String STRUCTURE_TYPE = "CHAPTERS|PARTS";
    public static final String STRUCTURE_TYPE_MESSAGE = "must be CHAPTERS or PARTS";

    private BookValues() {
    }
}