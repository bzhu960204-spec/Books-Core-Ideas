package com.bookscoreideas.dto;

import com.bookscoreideas.entity.ChapterImage;

public record ChapterImageDto(
        Long id,
        String filename,
        String originalName,
        String contentType,
        Integer orderIndex) {

    public static ChapterImageDto from(ChapterImage image) {
        return new ChapterImageDto(image.getId(), image.getFilename(), image.getOriginalName(),
                image.getContentType(), image.getOrderIndex());
    }
}
