package com.bookscoreideas.dto;

import com.bookscoreideas.entity.Chapter;

import java.util.List;

/** A chapter with its key ideas, as shown on the book page. */
public record ChapterDto(
        Long id,
        String title,
        Integer orderIndex,
        String summary,
        Long partId,
        List<KeyIdeaDto> keyIdeas) {

    public static ChapterDto from(Chapter chapter, List<KeyIdeaDto> keyIdeas) {
        return new ChapterDto(chapter.getId(), chapter.getTitle(), chapter.getOrderIndex(),
                chapter.getSummary(), chapter.getPartId(), keyIdeas);
    }
}
