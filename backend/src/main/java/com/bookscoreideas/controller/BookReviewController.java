package com.bookscoreideas.controller;

import com.bookscoreideas.entity.Book;
import com.bookscoreideas.entity.BookReview;
import com.bookscoreideas.repository.BookRepository;
import com.bookscoreideas.repository.BookReviewRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/books/{bookId}/review")
public class BookReviewController {

    private final BookReviewRepository reviewRepository;
    private final BookRepository bookRepository;

    public BookReviewController(BookReviewRepository reviewRepository, BookRepository bookRepository) {
        this.reviewRepository = reviewRepository;
        this.bookRepository = bookRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getReview(@PathVariable Long bookId) {
        return reviewRepository.findByBookId(bookId)
                .map(review -> {
                    Map<String, Object> map = new java.util.HashMap<>();
                    map.put("content", review.getContent() != null ? review.getContent() : "");
                    map.put("updatedAt", review.getUpdatedAt() != null ? review.getUpdatedAt().toString() : "");
                    return ResponseEntity.ok(map);
                })
                .orElseGet(() -> {
                    Map<String, Object> map = new java.util.HashMap<>();
                    map.put("content", "");
                    map.put("updatedAt", "");
                    return ResponseEntity.ok(map);
                });
    }

    @PutMapping
    public ResponseEntity<Map<String, Object>> saveReview(@PathVariable Long bookId, @RequestBody Map<String, String> body) {
        return bookRepository.findById(bookId).map(book -> {
            BookReview review = reviewRepository.findByBookId(bookId).orElseGet(() -> {
                BookReview r = new BookReview();
                r.setBook(book);
                return r;
            });
            review.setContent(body.getOrDefault("content", ""));
            reviewRepository.save(review);
            Map<String, Object> map = new java.util.HashMap<>();
            map.put("content", review.getContent() != null ? review.getContent() : "");
            map.put("updatedAt", review.getUpdatedAt() != null ? review.getUpdatedAt().toString() : "");
            return ResponseEntity.ok(map);
        }).orElse(ResponseEntity.notFound().build());
    }
}
