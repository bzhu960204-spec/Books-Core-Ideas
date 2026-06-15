package com.bookscoreideas.controller;

import com.bookscoreideas.repository.BookReviewRepository;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/reviews")
public class ReviewBankController {

    private final BookReviewRepository reviewRepository;

    public ReviewBankController(BookReviewRepository reviewRepository) {
        this.reviewRepository = reviewRepository;
    }

    @GetMapping
    public List<Map<String, Object>> getAllReviews() {
        return reviewRepository.findAllByOrderByUpdatedAtDescIdDesc().stream()
                .filter(r -> r.getContent() != null && !r.getContent().isBlank())
                .map(r -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", r.getId());
                    map.put("bookId", r.getBook().getId());
                    map.put("bookTitle", r.getBook().getTitle());
                    map.put("bookAuthor", r.getBook().getAuthor());
                    map.put("bookCoverUrl", r.getBook().getCoverUrl());
                    map.put("title", r.getTitle() != null ? r.getTitle() : "");
                    map.put("content", r.getContent());
                    map.put("updatedAt", r.getUpdatedAt() != null ? r.getUpdatedAt().toString() : "");
                    return map;
                })
                .collect(Collectors.toList());
    }
}
