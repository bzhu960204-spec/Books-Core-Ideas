package com.bookscoreideas.dto;

import java.util.List;

/**
 * What an image upload did (BUG-10): the images it saved, and every file it did not save
 * with a reason the user can read.
 */
public record ImageUploadDto(List<ChapterImageDto> images, List<SkippedFile> skipped) {
}
