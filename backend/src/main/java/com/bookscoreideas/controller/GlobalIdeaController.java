package com.bookscoreideas.controller;

import com.bookscoreideas.dto.IdeaSearchResult;
import com.bookscoreideas.repository.KeyIdeaRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ideas")
public class GlobalIdeaController {

    private final KeyIdeaRepository keyIdeaRepository;

    public GlobalIdeaController(KeyIdeaRepository keyIdeaRepository) {
        this.keyIdeaRepository = keyIdeaRepository;
    }

    @GetMapping
    public List<IdeaSearchResult> searchIdeas(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long bookId,
            @RequestParam(required = false) String tag) {
        return keyIdeaRepository.searchIdeas(q, bookId, tag);
    }
}
