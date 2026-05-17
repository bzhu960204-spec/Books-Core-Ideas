package com.bookscoreideas.controller;

import com.bookscoreideas.dto.ExcerptSearchResult;
import com.bookscoreideas.repository.ExcerptRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/excerpts")
public class GlobalExcerptController {

    private final ExcerptRepository excerptRepository;

    public GlobalExcerptController(ExcerptRepository excerptRepository) {
        this.excerptRepository = excerptRepository;
    }

    @GetMapping
    public List<ExcerptSearchResult> searchExcerpts(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long bookId) {
        return excerptRepository.searchExcerpts(q, bookId);
    }
}
