package com.bookscoreideas.controller;

import com.bookscoreideas.dto.BookmarkDto;
import com.bookscoreideas.service.BookmarkService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ReadingBookmarkController {

    private final BookmarkService bookmarkService;

    public ReadingBookmarkController(BookmarkService bookmarkService) {
        this.bookmarkService = bookmarkService;
    }

    @PostMapping("/chapters/{chapterId}/bookmarks")
    public ResponseEntity<BookmarkDto> create(@PathVariable Long chapterId,
                                              @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = body != null ? body : Map.of();
        Double scrollRatio = payload.get("scrollRatio") instanceof Number number ? number.doubleValue() : null;
        Object note = payload.get("note");
        String trimmedNote = note != null && !note.toString().isBlank() ? note.toString().trim() : null;
        return ResponseEntity.of(bookmarkService.create(chapterId, scrollRatio, trimmedNote));
    }

    @GetMapping("/books/{bookId}/bookmarks/latest")
    public ResponseEntity<BookmarkDto> latest(@PathVariable Long bookId) {
        return bookmarkService.latest(bookId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/bookmarks")
    public List<BookmarkDto> list(@RequestParam(required = false) Long bookId) {
        return bookmarkService.list(bookId);
    }

    @DeleteMapping("/bookmarks/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return bookmarkService.delete(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}