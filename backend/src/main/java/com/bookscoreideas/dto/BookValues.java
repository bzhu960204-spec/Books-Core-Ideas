package com.bookscoreideas.dto;

/**
 * Allowed values of the book's string-coded fields, validated on every write (BE-05).
 * They stay strings in the database: existing books store "" as well as null for "no
 * reading status", so mapping them to a Java enum would first need a data migration.
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