package com.bookscoreideas.controller;

import com.bookscoreideas.entity.BookReview;
import com.bookscoreideas.repository.BookRepository;
import com.bookscoreideas.repository.BookReviewRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/books/{bookId}/reviews")
public class BookReviewController {

    private final BookReviewRepository reviewRepository;
    private final BookRepository bookRepository;

    public BookReviewController(BookReviewRepository reviewRepository, BookRepository bookRepository) {
        this.reviewRepository = reviewRepository;
        this.bookRepository = bookRepository;
    }

    @GetMapping
    public List<Map<String, Object>> listReviews(@PathVariable Long bookId) {
        return reviewRepository.findByBookIdOrderByUpdatedAtDescIdDesc(bookId).stream()
                .map(BookReviewController::toMap)
                .collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createReview(@PathVariable Long bookId,
                                                            @RequestBody Map<String, String> body) {
        return bookRepository.findById(bookId).map(book -> {
            BookReview review = new BookReview();
            review.setBook(book);
            review.setContent(body.getOrDefault("content", ""));
            reviewRepository.save(review);
            return ResponseEntity.ok(toMap(review));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{reviewId}")
    public ResponseEntity<Map<String, Object>> updateReview(@PathVariable Long bookId,
                                                            @PathVariable Long reviewId,
                                                            @RequestBody Map<String, String> body) {
        return reviewRepository.findById(reviewId)
                .filter(r -> r.getBook() != null && bookId.equals(r.getBook().getId()))
                .map(review -> {
                    review.setContent(body.getOrDefault("content", ""));
                    reviewRepository.save(review);
                    return ResponseEntity.ok(toMap(review));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{reviewId}")
    public ResponseEntity<Void> deleteReview(@PathVariable Long bookId, @PathVariable Long reviewId) {
        return reviewRepository.findById(reviewId)
                .filter(r -> r.getBook() != null && bookId.equals(r.getBook().getId()))
                .map(review -> {
                    reviewRepository.delete(review);
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    static Map<String, Object> toMap(BookReview review) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", review.getId());
        map.put("bookId", review.getBook() != null ? review.getBook().getId() : null);
        map.put("content", review.getContent() != null ? review.getContent() : "");
        map.put("updatedAt", review.getUpdatedAt() != null ? review.getUpdatedAt().toString() : "");
        return map;
    }
}
