package com.bookscoreideas.controller;

import com.bookscoreideas.dto.ReviewDto;
import com.bookscoreideas.service.ReviewService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/books/{bookId}/reviews")
public class BookReviewController {

    private final ReviewService reviewService;

    public BookReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @GetMapping
    public List<ReviewDto> listReviews(@PathVariable Long bookId) {
        return reviewService.list(bookId);
    }

    @PostMapping
    public ResponseEntity<ReviewDto> createReview(@PathVariable Long bookId,
                                                  @RequestBody Map<String, String> body) {
        return ResponseEntity.of(reviewService.create(bookId,
                body.getOrDefault("title", ""), body.getOrDefault("content", "")));
    }

    @PutMapping("/{reviewId}")
    public ResponseEntity<ReviewDto> updateReview(@PathVariable Long bookId,
                                                  @PathVariable Long reviewId,
                                                  @RequestBody Map<String, String> body) {
        var changes = new ReviewService.ReviewChanges(
                body.containsKey("title"), body.get("title"),
                body.containsKey("content"), body.get("content"));
        return ResponseEntity.of(reviewService.update(bookId, reviewId, changes));
    }

    @DeleteMapping("/{reviewId}")
    public ResponseEntity<Void> deleteReview(@PathVariable Long bookId, @PathVariable Long reviewId) {
        return reviewService.delete(bookId, reviewId)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}