package com.bookscoreideas.controller;

import com.bookscoreideas.dto.ExcerptRequest;
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
    public ResponseEntity<Excerpt> createExcerpt(@PathVariable Long chapterId, @Valid @RequestBody ExcerptRequest request) {
        return chapterRepository.findById(chapterId).map(chapter -> {
            Excerpt excerpt = new Excerpt();
            apply(excerpt, request);
            excerpt.setChapter(chapter);
            return ResponseEntity.ok(excerptRepository.save(excerpt));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{excerptId}")
    public ResponseEntity<Excerpt> updateExcerpt(@PathVariable Long chapterId,
                                                  @PathVariable Long excerptId,
                                                  @Valid @RequestBody ExcerptRequest request) {
        return excerptRepository.findByIdAndChapterId(excerptId, chapterId).map(existing -> {
            apply(existing, request);
            return ResponseEntity.ok(excerptRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    private static void apply(Excerpt excerpt, ExcerptRequest request) {
        excerpt.setContent(request.content());
        excerpt.setNote(request.note());
        excerpt.setSource(request.source());
        excerpt.setOrderIndex(request.orderIndex());
        excerpt.setHighlighted(request.highlighted());
    }

    @DeleteMapping("/{excerptId}")
    public ResponseEntity<Void> deleteExcerpt(@PathVariable Long chapterId, @PathVariable Long excerptId) {
        return excerptRepository.findByIdAndChapterId(excerptId, chapterId).map(excerpt -> {
            excerptRepository.delete(excerpt);
            return ResponseEntity.ok().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }
}
