package com.bookscoreideas.dto;

import com.bookscoreideas.entity.Part;

public record PartDto(
        Long id,
        String title,
        Integer orderIndex,
        String summary) {

    public static PartDto from(Part part) {
        return new PartDto(part.getId(), part.getTitle(), part.getOrderIndex(), part.getSummary());
    }
}
