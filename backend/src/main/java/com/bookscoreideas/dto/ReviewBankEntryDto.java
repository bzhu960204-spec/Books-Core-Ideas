package com.bookscoreideas.dto;

import com.bookscoreideas.entity.Book;
import com.bookscoreideas.entity.BookReview;

/** A review in the Review Bank, with the book it belongs to. */
public record ReviewBankEntryDto(
        Long id,
        Long bookId,
        String bookTitle,
        String bookAuthor,
        String bookCoverUrl,
        String title,
        String content,
        String updatedAt) {

    public static ReviewBankEntryDto from(BookReview review) {
        Book book = review.getBook();
        return new ReviewBankEntryDto(
                review.getId(),
                book.getId(),
                book.getTitle(),
                book.getAuthor(),
                book.getCoverUrl(),
                review.getTitle() != null ? review.getTitle() : "",
                review.getContent(),
                review.getUpdatedAt() != null ? review.getUpdatedAt().toString() : "");
    }
}
