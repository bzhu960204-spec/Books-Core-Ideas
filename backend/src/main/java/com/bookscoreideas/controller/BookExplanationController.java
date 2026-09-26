package com.bookscoreideas.controller;

import com.bookscoreideas.repository.ChapterExplanationRepository;
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

    private final ChapterExplanationRepository explanationRepository;

    public BookExplanationController(ChapterExplanationRepository explanationRepository) {
        this.explanationRepository = explanationRepository;
    }

    @GetMapping
    public List<Long> chapterIds(@PathVariable Long bookId) {
        return explanationRepository.findChapterIdsByBookId(bookId);
    }
}
