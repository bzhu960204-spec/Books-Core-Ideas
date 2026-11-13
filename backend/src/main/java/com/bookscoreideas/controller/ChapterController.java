package com.bookscoreideas.controller;

import com.bookscoreideas.dto.ChapterDto;
import com.bookscoreideas.dto.ChapterOrderRequest;
import com.bookscoreideas.dto.ChapterRequest;
import com.bookscoreideas.service.ChapterService;
import com.bookscoreideas.web.Responses;
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
        return Responses.created(chapterService.create(bookId, request), "Book", bookId);
    }

    @PutMapping("/order")
    public ResponseEntity<Void> reorderChapters(@PathVariable Long bookId,
                                                @Valid @RequestBody ChapterOrderRequest request) {
        chapterService.reorder(bookId, request);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{chapterId}")
    public ResponseEntity<ChapterDto> updateChapter(@PathVariable Long bookId,
                                                    @PathVariable Long chapterId,
                                                    @Valid @RequestBody ChapterRequest request) {
        return Responses.ok(chapterService.update(bookId, chapterId, request), "Chapter", chapterId);
    }

    @DeleteMapping("/{chapterId}")
    public ResponseEntity<Void> deleteChapter(@PathVariable Long bookId, @PathVariable Long chapterId) {
        return Responses.deleted(chapterService.delete(bookId, chapterId), "Chapter", chapterId);
    }
}
