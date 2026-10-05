package com.bookscoreideas.controller;

import com.bookscoreideas.entity.Book;
import com.bookscoreideas.entity.Chapter;
import com.bookscoreideas.entity.ReadingBookmark;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.ReadingBookmarkRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// Reading history as manual bookmarks on chapter explanations. Creating a
// bookmark records "I read up to here" (chapter + scroll position + time); the
// latest bookmark per book powers "continue reading", and the full list powers
// the reading-history timeline.
@RestController
@RequestMapping("/api")
public class ReadingBookmarkController {

    private final ReadingBookmarkRepository bookmarkRepository;
    private final ChapterRepository chapterRepository;

    public ReadingBookmarkController(ReadingBookmarkRepository bookmarkRepository,
                                     ChapterRepository chapterRepository) {
        this.bookmarkRepository = bookmarkRepository;
        this.chapterRepository = chapterRepository;
    }

    @PostMapping("/chapters/{chapterId}/bookmarks")
    public ResponseEntity<Map<String, Object>> create(@PathVariable Long chapterId,
                                                       @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = body != null ? body : Map.of();
        return chapterRepository.findById(chapterId).map(chapter -> {
            ReadingBookmark bookmark = new ReadingBookmark();
            bookmark.setChapter(chapter);
            bookmark.setBook(chapter.getBook());
            Object ratio = payload.get("scrollRatio");
            if (ratio instanceof Number number) {
                bookmark.setScrollRatio(number.doubleValue());
            }
            Object note = payload.get("note");
            if (note != null && !note.toString().isBlank()) {
                bookmark.setNote(note.toString().trim());
            }
            bookmarkRepository.save(bookmark);
            return ResponseEntity.ok(toMap(bookmark));
        }).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/books/{bookId}/bookmarks/latest")
    public ResponseEntity<Map<String, Object>> latest(@PathVariable Long bookId) {
        return bookmarkRepository.findFirstByBookIdOrderByCreatedAtDescIdDesc(bookId)
                .map(b -> ResponseEntity.ok(toMap(b)))
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/bookmarks")
    public List<Map<String, Object>> list(@RequestParam(required = false) Long bookId) {
        List<ReadingBookmark> items = bookId != null
                ? bookmarkRepository.findByBookIdOrderByCreatedAtDescIdDesc(bookId)
                : bookmarkRepository.findAllByOrderByCreatedAtDescIdDesc();
        return items.stream().map(this::toMap).collect(Collectors.toList());
    }

    @DeleteMapping("/bookmarks/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!bookmarkRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        bookmarkRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private Map<String, Object> toMap(ReadingBookmark bookmark) {
        Map<String, Object> map = new HashMap<>();
        Chapter chapter = bookmark.getChapter();
        Book book = bookmark.getBook();
        map.put("id", bookmark.getId());
        map.put("chapterId", chapter != null ? chapter.getId() : null);
        map.put("chapterTitle", chapter != null ? chapter.getTitle() : "");
        map.put("bookId", book != null ? book.getId() : null);
        map.put("bookTitle", book != null ? book.getTitle() : "");
        map.put("bookAuthor", book != null ? book.getAuthor() : "");
        map.put("bookCoverUrl", book != null ? book.getCoverUrl() : null);
        map.put("scrollRatio", bookmark.getScrollRatio());
        map.put("note", bookmark.getNote() != null ? bookmark.getNote() : "");
        map.put("createdAt", bookmark.getCreatedAt() != null ? bookmark.getCreatedAt().toString() : "");
        return map;
    }
}
