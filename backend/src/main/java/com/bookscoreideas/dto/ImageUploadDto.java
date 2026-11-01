package com.bookscoreideas.dto;

import java.util.List;

/**
 * What an image upload did (BUG-10): the images it saved, and every file it did not save
 * with a reason the user can read.
 */
public record ImageUploadDto(List<ChapterImageDto> images, List<SkippedFile> skipped) {

    public record SkippedFile(String name, String reason) {
        public static final String EMPTY = "empty file";
        public static final String NOT_AN_IMAGE = "not a PNG, JPEG, GIF or WebP image";
        public static final String NOT_SAVED = "could not be saved";
    }
}
