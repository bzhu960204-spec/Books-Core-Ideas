package com.bookscoreideas.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Optional;

/**
 * The image formats the app stores and serves (SEC-02), recognised by their first bytes.
 * Nothing else is accepted: chapter images are served from the app's own origin, and e.g.
 * SVG can carry scripts. The client's Content-Type and file extension are never trusted.
 */
public enum ImageType {
    PNG("image/png", ".png"),
    JPEG("image/jpeg", ".jpg"),
    GIF("image/gif", ".gif"),
    WEBP("image/webp", ".webp");

    /** Bytes needed to recognise every type. */
    public static final int HEADER_LENGTH = 12;

    private static final byte[] PNG_SIGNATURE = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};

    private final String contentType;
    private final String extension;

    ImageType(String contentType, String extension) {
        this.contentType = contentType;
        this.extension = extension;
    }

    public String contentType() { return contentType; }

    /** Lower-case, with the dot. */
    public String extension() { return extension; }

    public static Optional<ImageType> detect(byte[] header) {
        if (startsWith(header, 0, PNG_SIGNATURE)) return Optional.of(PNG);
        if (startsWith(header, 0, new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF})) return Optional.of(JPEG);
        if (startsWith(header, 0, ascii("GIF87a")) || startsWith(header, 0, ascii("GIF89a"))) return Optional.of(GIF);
        if (startsWith(header, 0, ascii("RIFF")) && startsWith(header, 8, ascii("WEBP"))) return Optional.of(WEBP);
        return Optional.empty();
    }

    public static Optional<ImageType> detect(Path file) throws IOException {
        try (InputStream in = Files.newInputStream(file)) {
            return detect(in.readNBytes(HEADER_LENGTH));
        }
    }

    private static boolean startsWith(byte[] data, int offset, byte[] prefix) {
        return data.length >= offset + prefix.length
                && Arrays.equals(data, offset, offset + prefix.length, prefix, 0, prefix.length);
    }

    private static byte[] ascii(String s) {
        return s.getBytes(StandardCharsets.US_ASCII);
    }
}
