package com.bookscoreideas.entity;

/** How a book's chapters are organised (DB-06). */
public enum StructureType {
    /** Flat list of chapters. */
    CHAPTERS,
    /** Parts that each contain chapters; chapters outside any part are "ungrouped". */
    PARTS;

    /** Unknown or missing values mean CHAPTERS, as they always have for imports. */
    public static StructureType fromTextOrDefault(String text) {
        return "PARTS".equals(text) ? PARTS : CHAPTERS;
    }
}
