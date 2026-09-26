package com.bookscoreideas.controller;

import com.bookscoreideas.entity.ChapterExplanation;
import com.bookscoreideas.repository.ChapterExplanationRepository;
import com.bookscoreideas.repository.ChapterRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/chapters/{chapterId}/explanation")
public class ChapterExplanationController {

    private final ChapterExplanationRepository explanationRepository;
    private final ChapterRepository chapterRepository;

    public ChapterExplanationController(ChapterExplanationRepository explanationRepository,
                                        ChapterRepository chapterRepository) {
        this.explanationRepository = explanationRepository;
        this.chapterRepository = chapterRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getExplanation(@PathVariable Long chapterId) {
        return explanationRepository.findByChapterId(chapterId)
                .map(e -> ResponseEntity.ok(toMap(e)))
                .orElse(ResponseEntity.noContent().build());
    }

    // Upsert: one explanation per chapter, so PUT creates or updates in place.
    @PutMapping
    public ResponseEntity<Map<String, Object>> saveExplanation(@PathVariable Long chapterId,
                                                               @RequestBody Map<String, String> body) {
        return chapterRepository.findById(chapterId).map(chapter -> {
            ChapterExplanation explanation = explanationRepository.findByChapterId(chapterId)
                    .orElseGet(() -> {
                        ChapterExplanation created = new ChapterExplanation();
                        created.setChapter(chapter);
                        return created;
                    });
            explanation.setContent(body.getOrDefault("content", ""));
            explanationRepository.save(explanation);
            return ResponseEntity.ok(toMap(explanation));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteExplanation(@PathVariable Long chapterId) {
        return explanationRepository.findByChapterId(chapterId)
                .map(explanation -> {
                    explanationRepository.delete(explanation);
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    static Map<String, Object> toMap(ChapterExplanation explanation) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", explanation.getId());
        map.put("chapterId", explanation.getChapter() != null ? explanation.getChapter().getId() : null);
        map.put("content", explanation.getContent() != null ? explanation.getContent() : "");
        map.put("updatedAt", explanation.getUpdatedAt() != null ? explanation.getUpdatedAt().toString() : "");
        return map;
    }
}
