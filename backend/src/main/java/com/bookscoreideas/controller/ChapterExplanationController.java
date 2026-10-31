package com.bookscoreideas.controller;

import com.bookscoreideas.dto.ExplanationDto;
import com.bookscoreideas.dto.ExplanationRequest;
import com.bookscoreideas.service.ExplanationService;
import com.bookscoreideas.web.Responses;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chapters/{chapterId}/explanation")
public class ChapterExplanationController {

    private final ExplanationService explanationService;

    public ChapterExplanationController(ExplanationService explanationService) {
        this.explanationService = explanationService;
    }

    // 204 when the chapter has no explanation (optional single resource); 404 if the
    // chapter itself is missing (thrown by the service). See doc/api-conventions.md.
    @GetMapping
    public ResponseEntity<ExplanationDto> getExplanation(@PathVariable Long chapterId) {
        return explanationService.get(chapterId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    // Upsert: one explanation per chapter, so PUT creates or updates in place (200).
    @PutMapping
    public ResponseEntity<ExplanationDto> saveExplanation(@PathVariable Long chapterId,
                                                          @RequestBody ExplanationRequest body) {
        String content = body.content() != null ? body.content() : "";
        return Responses.ok(explanationService.save(chapterId, content), "Chapter", chapterId);
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteExplanation(@PathVariable Long chapterId) {
        return Responses.deleted(explanationService.delete(chapterId), "Explanation of chapter", chapterId);
    }
}
