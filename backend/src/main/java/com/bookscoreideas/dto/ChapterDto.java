package com.bookscoreideas.dto;

import com.bookscoreideas.entity.Chapter;

/** A chapter as shown on the book page. */
public record ChapterDto(
        Long id,
        String title,
        Integer orderIndex,
        String summary,
        Long partId) {

    public static ChapterDto from(Chapter chapter) {
        return new ChapterDto(chapter.getId(), chapter.getTitle(), chapter.getOrderIndex(),
                chapter.getSummary(), chapter.getPartId());
    }
}
