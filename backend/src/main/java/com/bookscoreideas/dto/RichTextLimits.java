package com.bookscoreideas.dto;

/**
 * Upper bound for rich-text bodies (chapter explanations, book reviews), DB-04.
 * Deliberately generous: today's largest body is about 0.13 MB, and two of the
 * largest images the editor accepts (5 MB, about 6.7 MB as inline base64) still
 * fit. It only stops accidents; Jackson alone would accept 100 million characters.
 */
public final class RichTextLimits {

    public static final int MAX_CHARS = 20_000_000;
    public static final String MAX_CHARS_MESSAGE = "must be at most 20 MB (pasted images take the most space)";

    private RichTextLimits() {
    }
}
