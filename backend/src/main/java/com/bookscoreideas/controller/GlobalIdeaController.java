package com.bookscoreideas.controller;

import com.bookscoreideas.dto.IdeaSearchResult;
import com.bookscoreideas.service.KeyIdeaService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ideas")
public class GlobalIdeaController {

    private final KeyIdeaService keyIdeaService;

    public GlobalIdeaController(KeyIdeaService keyIdeaService) {
        this.keyIdeaService = keyIdeaService;
    }

    @GetMapping
    public List<IdeaSearchResult> searchIdeas(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long bookId,
            @RequestParam(required = false) String tag) {
        return keyIdeaService.search(q, bookId, tag);
    }
}