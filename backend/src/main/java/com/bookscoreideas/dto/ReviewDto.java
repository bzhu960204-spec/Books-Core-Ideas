package com.bookscoreideas.dto;

import com.bookscoreideas.entity.BookReview;

/** A review under its book; absent text and date are sent as empty strings. */
public record ReviewDto(Long id, Long bookId, String title, String content, String updatedAt) {

    public static ReviewDto from(BookReview review) {
        return new ReviewDto(
                review.getId(),
                review.getBook() != null ? review.getBook().getId() : null,
                review.getTitle() != null ? review.getTitle() : "",
                review.getContent() != null ? review.getContent() : "",
                review.getUpdatedAt() != null ? review.getUpdatedAt().toString() : "");
    }
}
