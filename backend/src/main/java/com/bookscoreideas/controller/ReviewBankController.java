package com.bookscoreideas.controller;

import com.bookscoreideas.dto.ReviewBankEntryDto;
import com.bookscoreideas.service.ReviewService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reviews")
public class ReviewBankController {

    private final ReviewService reviewService;

    public ReviewBankController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @GetMapping
    public List<ReviewBankEntryDto> getAllReviews() {
        return reviewService.bank();
    }
}