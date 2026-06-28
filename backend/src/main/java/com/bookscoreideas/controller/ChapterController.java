package com.bookscoreideas.controller;

import com.bookscoreideas.entity.Chapter;
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
    public ResponseEntity<Chapter> createChapter(@PathVariable Long bookId, @Valid @RequestBody Chapter chapter) {
        return bookRepository.findById(bookId).map(book -> {
            chapter.setBook(book);
            applyPart(chapter, chapter.getPartId());
            return ResponseEntity.ok(chapterRepository.save(chapter));
        }).orElse(ResponseEntity.notFound().build());
    }

    // Resolve the optional partId from the request into the Part relationship.
    // A null partId clears the grouping (plain chapter).
    private void applyPart(Chapter chapter, Long partId) {
        if (partId != null) {
            partRepository.findById(partId).ifPresent(chapter::setPart);
        } else {
            chapter.setPart(null);
        }
    }

    @PutMapping("/{chapterId}")
    public ResponseEntity<Chapter> updateChapter(@PathVariable Long bookId,
                                                  @PathVariable Long chapterId,
                                                  @Valid @RequestBody Chapter chapter) {
        if (!bookRepository.existsById(bookId)) {
            return ResponseEntity.notFound().build();
        }
        return chapterRepository.findById(chapterId).map(existing -> {
            existing.setTitle(chapter.getTitle());
            existing.setOrderIndex(chapter.getOrderIndex());
            existing.setSummary(chapter.getSummary());
            applyPart(existing, chapter.getPartId());
            return ResponseEntity.ok(chapterRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{chapterId}")
    public ResponseEntity<Void> deleteChapter(@PathVariable Long bookId, @PathVariable Long chapterId) {
        if (!bookRepository.existsById(bookId)) {
            return ResponseEntity.notFound().build();
        }
        return chapterRepository.findById(chapterId).map(chapter -> {
            chapterRepository.delete(chapter);
            return ResponseEntity.ok().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }
}
