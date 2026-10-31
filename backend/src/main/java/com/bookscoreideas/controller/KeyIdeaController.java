package com.bookscoreideas.controller;

import com.bookscoreideas.dto.KeyIdeaRequest;
import com.bookscoreideas.entity.KeyIdea;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.KeyIdeaRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chapters/{chapterId}/ideas")
public class KeyIdeaController {

    private final KeyIdeaRepository keyIdeaRepository;
    private final ChapterRepository chapterRepository;

    public KeyIdeaController(KeyIdeaRepository keyIdeaRepository, ChapterRepository chapterRepository) {
        this.keyIdeaRepository = keyIdeaRepository;
        this.chapterRepository = chapterRepository;
    }

    @GetMapping
    public List<KeyIdea> getIdeas(@PathVariable Long chapterId) {
        return keyIdeaRepository.findByChapterIdOrderByOrderIndexAsc(chapterId);
    }

    @PostMapping
    public ResponseEntity<KeyIdea> createIdea(@PathVariable Long chapterId, @Valid @RequestBody KeyIdeaRequest request) {
        return chapterRepository.findById(chapterId).map(chapter -> {
            KeyIdea idea = new KeyIdea();
            apply(idea, request);
            idea.setChapter(chapter);
            return ResponseEntity.ok(keyIdeaRepository.save(idea));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{ideaId}")
    public ResponseEntity<KeyIdea> updateIdea(@PathVariable Long chapterId,
                                               @PathVariable Long ideaId,
                                               @Valid @RequestBody KeyIdeaRequest request) {
        return keyIdeaRepository.findByIdAndChapterId(ideaId, chapterId).map(existing -> {
            apply(existing, request);
            return ResponseEntity.ok(keyIdeaRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    private static void apply(KeyIdea idea, KeyIdeaRequest request) {
        idea.setContent(request.content());
        idea.setExample(request.example());
        idea.setTags(request.tags());
        idea.setHighlighted(request.highlighted());
        idea.setOrderIndex(request.orderIndex());
    }

    @DeleteMapping("/{ideaId}")
    public ResponseEntity<Void> deleteIdea(@PathVariable Long chapterId, @PathVariable Long ideaId) {
        return keyIdeaRepository.findByIdAndChapterId(ideaId, chapterId).map(idea -> {
            keyIdeaRepository.delete(idea);
            return ResponseEntity.ok().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }
}
