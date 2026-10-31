package com.bookscoreideas.controller;

import com.bookscoreideas.dto.ChapterRequest;
import com.bookscoreideas.entity.Chapter;
import com.bookscoreideas.entity.Part;
import com.bookscoreideas.repository.BookRepository;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.PartRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/books/{bookId}/chapters")
public class ChapterController {

    private final ChapterRepository chapterRepository;
    private final BookRepository bookRepository;
    private final PartRepository partRepository;

    public ChapterController(ChapterRepository chapterRepository, BookRepository bookRepository,
                            PartRepository partRepository) {
        this.chapterRepository = chapterRepository;
        this.bookRepository = bookRepository;
        this.partRepository = partRepository;
    }

    @GetMapping
    public List<Chapter> getChapters(@PathVariable Long bookId) {
        return chapterRepository.findByBookIdOrderByOrderIndexAsc(bookId);
    }

    @PostMapping
    public ResponseEntity<Chapter> createChapter(@PathVariable Long bookId, @Valid @RequestBody ChapterRequest request) {
        return bookRepository.findById(bookId).map(book -> {
            Chapter chapter = new Chapter();
            chapter.setTitle(request.title());
            chapter.setOrderIndex(request.orderIndex());
            chapter.setSummary(request.summary());
            applyPart(chapter, bookId, request.partId());
            chapter.setBook(book);
            return ResponseEntity.ok(chapterRepository.save(chapter));
        }).orElse(ResponseEntity.notFound().build());
    }

    // Resolve the optional partId from the request into the Part relationship.
    // A null partId clears the grouping (plain chapter); a part from another
    // book is rejected.
    private void applyPart(Chapter chapter, Long bookId, Long partId) {
        if (partId == null) {
            chapter.setPart(null);
            return;
        }
        Part part = partRepository.findByIdAndBookId(partId, bookId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Part " + partId + " does not belong to book " + bookId));
        chapter.setPart(part);
    }

    @PutMapping("/{chapterId}")
    public ResponseEntity<Chapter> updateChapter(@PathVariable Long bookId,
                                                  @PathVariable Long chapterId,
                                                  @Valid @RequestBody ChapterRequest request) {
        return chapterRepository.findByIdAndBookId(chapterId, bookId).map(existing -> {
            applyPart(existing, bookId, request.partId());
            existing.setTitle(request.title());
            existing.setOrderIndex(request.orderIndex());
            existing.setSummary(request.summary());
            return ResponseEntity.ok(chapterRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{chapterId}")
    public ResponseEntity<Void> deleteChapter(@PathVariable Long bookId, @PathVariable Long chapterId) {
        return chapterRepository.findByIdAndBookId(chapterId, bookId).map(chapter -> {
            chapterRepository.delete(chapter);
            return ResponseEntity.ok().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }
}
