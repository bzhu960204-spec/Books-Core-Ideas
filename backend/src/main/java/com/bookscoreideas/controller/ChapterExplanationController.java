package com.bookscoreideas.controller;

import com.bookscoreideas.dto.ExplanationDto;
import com.bookscoreideas.dto.ExplanationRequest;
import com.bookscoreideas.service.ExplanationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chapters/{chapterId}/explanation")
public class ChapterExplanationController {

    private final ExplanationService explanationService;

    public ChapterExplanationController(ExplanationService explanationService) {
        this.explanationService = explanationService;
    }

    @GetMapping
    public ResponseEntity<ExplanationDto> getExplanation(@PathVariable Long chapterId) {
        return explanationService.get(chapterId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    // Upsert: one explanation per chapter, so PUT creates or updates in place.
    @PutMapping
    public ResponseEntity<ExplanationDto> saveExplanation(@PathVariable Long chapterId,
                                                          @RequestBody ExplanationRequest body) {
        return ResponseEntity.of(explanationService.save(chapterId, body.content() != null ? body.content() : ""));
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteExplanation(@PathVariable Long chapterId) {
        return explanationService.delete(chapterId)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
