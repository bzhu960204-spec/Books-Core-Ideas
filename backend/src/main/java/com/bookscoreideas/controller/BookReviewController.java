package com.bookscoreideas.controller;

import com.bookscoreideas.dto.ReviewDto;
import com.bookscoreideas.dto.ReviewRequest;
import com.bookscoreideas.service.ReviewService;
import com.bookscoreideas.web.Responses;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
                                                  @Valid @RequestBody ReviewRequest body) {
        String title = body.title() != null ? body.title() : "";
        String content = body.content() != null ? body.content() : "";
        return Responses.created(reviewService.create(bookId, title, content), "Book", bookId);
    }

    @PutMapping("/{reviewId}")
    public ResponseEntity<ReviewDto> updateReview(@PathVariable Long bookId,
                                                  @PathVariable Long reviewId,
                                                  @Valid @RequestBody ReviewRequest body) {
        var changes = new ReviewService.ReviewChanges(
                body.title() != null, body.title(),
                body.content() != null, body.content());
        return Responses.ok(reviewService.update(bookId, reviewId, changes), "Review", reviewId);
    }

    @DeleteMapping("/{reviewId}")
    public ResponseEntity<Void> deleteReview(@PathVariable Long bookId, @PathVariable Long reviewId) {
        return Responses.deleted(reviewService.delete(bookId, reviewId), "Review", reviewId);
    }
}
