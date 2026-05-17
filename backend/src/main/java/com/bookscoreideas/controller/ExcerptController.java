package com.bookscoreideas.controller;

import com.bookscoreideas.entity.Excerpt;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.ExcerptRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chapters/{chapterId}/excerpts")
public class ExcerptController {

    private final ExcerptRepository excerptRepository;
    private final ChapterRepository chapterRepository;

    public ExcerptController(ExcerptRepository excerptRepository, ChapterRepository chapterRepository) {
        this.excerptRepository = excerptRepository;
        this.chapterRepository = chapterRepository;
    }

    @GetMapping
    public List<Excerpt> getExcerpts(@PathVariable Long chapterId) {
        return excerptRepository.findByChapterIdOrderByOrderIndexAsc(chapterId);
    }

    @PostMapping
    public ResponseEntity<Excerpt> createExcerpt(@PathVariable Long chapterId, @Valid @RequestBody Excerpt excerpt) {
        return chapterRepository.findById(chapterId).map(chapter -> {
            excerpt.setChapter(chapter);
            return ResponseEntity.ok(excerptRepository.save(excerpt));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{excerptId}")
    public ResponseEntity<Excerpt> updateExcerpt(@PathVariable Long chapterId,
                                                  @PathVariable Long excerptId,
                                                  @Valid @RequestBody Excerpt excerpt) {
        if (!chapterRepository.existsById(chapterId)) {
            return ResponseEntity.notFound().build();
        }
        return excerptRepository.findById(excerptId).map(existing -> {
            existing.setContent(excerpt.getContent());
            existing.setNote(excerpt.getNote());
            existing.setSource(excerpt.getSource());
            existing.setOrderIndex(excerpt.getOrderIndex());
            existing.setHighlighted(excerpt.isHighlighted());
            return ResponseEntity.ok(excerptRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{excerptId}")
    public ResponseEntity<Void> deleteExcerpt(@PathVariable Long chapterId, @PathVariable Long excerptId) {
        if (!chapterRepository.existsById(chapterId)) {
            return ResponseEntity.notFound().build();
        }
        return excerptRepository.findById(excerptId).map(excerpt -> {
            excerptRepository.delete(excerpt);
            return ResponseEntity.ok().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }
}
