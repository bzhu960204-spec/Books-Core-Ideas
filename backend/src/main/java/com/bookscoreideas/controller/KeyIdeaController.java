package com.bookscoreideas.controller;

import com.bookscoreideas.dto.KeyIdeaDto;
import com.bookscoreideas.dto.KeyIdeaRequest;
import com.bookscoreideas.service.KeyIdeaService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chapters/{chapterId}/ideas")
public class KeyIdeaController {

    private final KeyIdeaService keyIdeaService;

    public KeyIdeaController(KeyIdeaService keyIdeaService) {
        this.keyIdeaService = keyIdeaService;
    }

    @GetMapping
    public List<KeyIdeaDto> getIdeas(@PathVariable Long chapterId) {
        return keyIdeaService.list(chapterId);
    }

    @PostMapping
    public ResponseEntity<KeyIdeaDto> createIdea(@PathVariable Long chapterId,
                                                 @Valid @RequestBody KeyIdeaRequest request) {
        return ResponseEntity.of(keyIdeaService.create(chapterId, request));
    }

    @PutMapping("/{ideaId}")
    public ResponseEntity<KeyIdeaDto> updateIdea(@PathVariable Long chapterId,
                                                 @PathVariable Long ideaId,
                                                 @Valid @RequestBody KeyIdeaRequest request) {
        return ResponseEntity.of(keyIdeaService.update(chapterId, ideaId, request));
    }

    @DeleteMapping("/{ideaId}")
    public ResponseEntity<Void> deleteIdea(@PathVariable Long chapterId, @PathVariable Long ideaId) {
        return keyIdeaService.delete(chapterId, ideaId)
                ? ResponseEntity.ok().build()
                : ResponseEntity.notFound().build();
    }
}