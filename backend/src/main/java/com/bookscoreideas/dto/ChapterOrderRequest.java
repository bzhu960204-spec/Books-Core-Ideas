package com.bookscoreideas.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/** Body of the chapter reorder: where each listed chapter now sits (its part and position number). */
public record ChapterOrderRequest(@NotNull List<@NotNull @Valid Placement> chapters) {

    /** partId null = no part (plain chapter / "Ungrouped"). */
    public record Placement(@NotNull Long id, Long partId, @NotNull Integer orderIndex) {
    }
}
