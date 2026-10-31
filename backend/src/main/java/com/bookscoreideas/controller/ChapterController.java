package com.bookscoreideas.controller;

import com.bookscoreideas.dto.ChapterDto;
import com.bookscoreideas.dto.ChapterRequest;
import com.bookscoreideas.service.ChapterService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/books/{bookId}/chapters")
public class ChapterController {

    private final ChapterService chapterService;

    public ChapterController(ChapterService chapterService) {
        this.chapterService = chapterService;
    }

    @GetMapping
    public List<ChapterDto> getChapters(@PathVariable Long bookId) {
        return chapterService.list(bookId);
    }

    @PostMapping
    public ResponseEntity<ChapterDto> createChapter(@PathVariable Long bookId,
                                                    @Valid @RequestBody ChapterRequest request) {
        return ResponseEntity.of(chapterService.create(bookId, request));
    }

    @PutMapping("/{chapterId}")
    public ResponseEntity<ChapterDto> updateChapter(@PathVariable Long bookId,
                                                    @PathVariable Long chapterId,
                                                    @Valid @RequestBody ChapterRequest request) {
        return ResponseEntity.of(chapterService.update(bookId, chapterId, request));
    }

    @DeleteMapping("/{chapterId}")
    public ResponseEntity<Void> deleteChapter(@PathVariable Long bookId, @PathVariable Long chapterId) {
        return chapterService.delete(bookId, chapterId)
                ? ResponseEntity.ok().build()
                : ResponseEntity.notFound().build();
    }
}
