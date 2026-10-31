package com.bookscoreideas.controller;

import com.bookscoreideas.dto.ExcerptDto;
import com.bookscoreideas.dto.ExcerptRequest;
import com.bookscoreideas.service.ExcerptService;
import com.bookscoreideas.web.Responses;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chapters/{chapterId}/excerpts")
public class ExcerptController {

    private final ExcerptService excerptService;

    public ExcerptController(ExcerptService excerptService) {
        this.excerptService = excerptService;
    }

    @GetMapping
    public List<ExcerptDto> getExcerpts(@PathVariable Long chapterId) {
        return excerptService.list(chapterId);
    }

    @PostMapping
    public ResponseEntity<ExcerptDto> createExcerpt(@PathVariable Long chapterId,
                                                    @Valid @RequestBody ExcerptRequest request) {
        return Responses.created(excerptService.create(chapterId, request), "Chapter", chapterId);
    }

    @PutMapping("/{excerptId}")
    public ResponseEntity<ExcerptDto> updateExcerpt(@PathVariable Long chapterId,
                                                    @PathVariable Long excerptId,
                                                    @Valid @RequestBody ExcerptRequest request) {
        return Responses.ok(excerptService.update(chapterId, excerptId, request), "Excerpt", excerptId);
    }

    @DeleteMapping("/{excerptId}")
    public ResponseEntity<Void> deleteExcerpt(@PathVariable Long chapterId, @PathVariable Long excerptId) {
        return Responses.deleted(excerptService.delete(chapterId, excerptId), "Excerpt", excerptId);
    }
}