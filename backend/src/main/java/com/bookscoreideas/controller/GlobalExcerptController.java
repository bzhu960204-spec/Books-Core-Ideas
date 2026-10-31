package com.bookscoreideas.controller;

import com.bookscoreideas.dto.ExcerptSearchResult;
import com.bookscoreideas.service.ExcerptService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/excerpts")
public class GlobalExcerptController {

    private final ExcerptService excerptService;

    public GlobalExcerptController(ExcerptService excerptService) {
        this.excerptService = excerptService;
    }

    @GetMapping
    public List<ExcerptSearchResult> searchExcerpts(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long bookId) {
        return excerptService.search(q, bookId);
    }
}