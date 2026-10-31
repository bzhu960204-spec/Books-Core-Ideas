package com.bookscoreideas.controller;

import com.bookscoreideas.service.ExplanationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

// Book-level lookup of which chapters already have an explanation, so the UI can
// show badges without downloading every explanation's (potentially large) body.
@RestController
@RequestMapping("/api/books/{bookId}/explanation-chapter-ids")
public class BookExplanationController {

    private final ExplanationService explanationService;

    public BookExplanationController(ExplanationService explanationService) {
        this.explanationService = explanationService;
    }

    @GetMapping
    public List<Long> chapterIds(@PathVariable Long bookId) {
        return explanationService.chapterIdsWithExplanation(bookId);
    }
}