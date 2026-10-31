package com.bookscoreideas.service;

import com.bookscoreideas.dto.ReviewBankEntryDto;
import com.bookscoreideas.dto.ReviewDto;
import com.bookscoreideas.entity.BookReview;
import com.bookscoreideas.repository.BookRepository;
import com.bookscoreideas.repository.BookReviewRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class ReviewService {

    /** A partial update: a field is changed only when it was present in the request. */
    public record ReviewChanges(boolean hasTitle, String title, boolean hasContent, String content) {
    }

    private final BookReviewRepository reviewRepository;
    private final BookRepository bookRepository;

    public ReviewService(BookReviewRepository reviewRepository, BookRepository bookRepository) {
        this.reviewRepository = reviewRepository;
        this.bookRepository = bookRepository;
    }

    @Transactional(readOnly = true)
    public List<ReviewDto> list(Long bookId) {
        return reviewRepository.findByBookIdOrderByUpdatedAtDescIdDesc(bookId).stream().map(ReviewDto::from).toList();
    }

    /** Every non-empty review, newest first (the Review Bank). */
    @Transactional(readOnly = true)
    public List<ReviewBankEntryDto> bank() {
        return reviewRepository.findAllWithBook().stream()
                .filter(r -> r.getContent() != null && !r.getContent().isBlank())
                .map(ReviewBankEntryDto::from)
                .toList();
    }

    /** @return empty if the book does not exist */
    @Transactional
    public Optional<ReviewDto> create(Long bookId, String title, String content) {
        return bookRepository.findById(bookId).map(book -> {
            BookReview review = new BookReview();
            review.setBook(book);
            review.setTitle(title);
            review.setContent(content);
            return ReviewDto.from(reviewRepository.saveAndFlush(review));
        });
    }

    /** @return empty if the review does not exist under this book */
    @Transactional
    public Optional<ReviewDto> update(Long bookId, Long reviewId, ReviewChanges changes) {
        return findInBook(bookId, reviewId).map(review -> {
            if (changes.hasTitle()) review.setTitle(changes.title());
            if (changes.hasContent()) review.setContent(changes.content());
            // Flush so @PreUpdate stamps updatedAt before it is returned.
            return ReviewDto.from(reviewRepository.saveAndFlush(review));
        });
    }

    /** @return false if the review does not exist under this book */
    @Transactional
    public boolean delete(Long bookId, Long reviewId) {
        return findInBook(bookId, reviewId).map(review -> {
            reviewRepository.delete(review);
            return true;
        }).orElse(false);
    }

    private Optional<BookReview> findInBook(Long bookId, Long reviewId) {
        return reviewRepository.findById(reviewId)
                .filter(r -> r.getBook() != null && bookId.equals(r.getBook().getId()));
    }
}
