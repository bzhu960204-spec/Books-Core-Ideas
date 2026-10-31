package com.bookscoreideas.controller;

import com.bookscoreideas.dto.BookmarkDto;
import com.bookscoreideas.dto.BookmarkRequest;
import com.bookscoreideas.service.BookmarkService;
import com.bookscoreideas.web.Responses;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ReadingBookmarkController {

    private final BookmarkService bookmarkService;

    public ReadingBookmarkController(BookmarkService bookmarkService) {
        this.bookmarkService = bookmarkService;
    }

    @PostMapping("/chapters/{chapterId}/bookmarks")
    public ResponseEntity<BookmarkDto> create(@PathVariable Long chapterId,
                                              @Valid @RequestBody(required = false) BookmarkRequest body) {
        BookmarkRequest request = body != null ? body : new BookmarkRequest(null, null);
        String note = request.note() != null && !request.note().isBlank() ? request.note().trim() : null;
        return Responses.created(bookmarkService.create(chapterId, request.scrollRatio(), note), "Chapter", chapterId);
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
        return Responses.deleted(bookmarkService.delete(id), "Bookmark", id);
    }
}
