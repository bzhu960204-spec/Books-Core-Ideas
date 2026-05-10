package com.bookscoreideas.controller;

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
    public ResponseEntity<KeyIdea> createIdea(@PathVariable Long chapterId, @Valid @RequestBody KeyIdea idea) {
        return chapterRepository.findById(chapterId).map(chapter -> {
            idea.setChapter(chapter);
            return ResponseEntity.ok(keyIdeaRepository.save(idea));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{ideaId}")
    public ResponseEntity<KeyIdea> updateIdea(@PathVariable Long chapterId,
                                               @PathVariable Long ideaId,
                                               @Valid @RequestBody KeyIdea idea) {
        if (!chapterRepository.existsById(chapterId)) {
            return ResponseEntity.notFound().build();
        }
        return keyIdeaRepository.findById(ideaId).map(existing -> {
            existing.setContent(idea.getContent());
            existing.setExample(idea.getExample());
            existing.setOrderIndex(idea.getOrderIndex());
            return ResponseEntity.ok(keyIdeaRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{ideaId}")
    public ResponseEntity<Void> deleteIdea(@PathVariable Long chapterId, @PathVariable Long ideaId) {
        if (!chapterRepository.existsById(chapterId)) {
            return ResponseEntity.notFound().build();
        }
        return keyIdeaRepository.findById(ideaId).map(idea -> {
            keyIdeaRepository.delete(idea);
            return ResponseEntity.ok().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }
}
