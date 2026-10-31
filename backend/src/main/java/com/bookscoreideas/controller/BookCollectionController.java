package com.bookscoreideas.controller;

import com.bookscoreideas.dto.BookCollectionRequest;
import com.bookscoreideas.dto.BookCollectionResponse;
import com.bookscoreideas.dto.BookDto;
import com.bookscoreideas.entity.BookCollection;
import com.bookscoreideas.service.BookCollectionService;
import com.bookscoreideas.service.BookService;
import com.bookscoreideas.web.Responses;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * CRUD for nested book collections (file-system-like folders) plus
 * book-membership management.
 */
@RestController
@RequestMapping("/api/book-collections")
public class BookCollectionController {

    private final BookCollectionService service;
    private final BookService bookService;

    public BookCollectionController(BookCollectionService service, BookService bookService) {
        this.service = service;
        this.bookService = bookService;
    }

    @GetMapping
    public List<BookCollectionResponse> list() {
        Map<Long, Long> counts = service.directMemberCounts();
        return service.list().stream()
                .map(c -> BookCollectionResponse.from(c, counts.getOrDefault(c.getId(), 0L)))
                .collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<BookCollectionResponse> create(@RequestBody BookCollectionRequest req) {
        BookCollection c = service.create(req.getName(), req.getParentId(), req.getSortOrder());
        return Responses.created(BookCollectionResponse.from(c, 0L));
    }

    @PutMapping("/{id}")
    public BookCollectionResponse update(@PathVariable Long id, @RequestBody BookCollectionRequest req) {
        BookCollection c = service.update(id, req.getName(), req.getSortOrder());
        long count = service.directMemberCounts().getOrDefault(c.getId(), 0L);
        return BookCollectionResponse.from(c, count);
    }

    @PutMapping("/{id}/move")
    public BookCollectionResponse move(@PathVariable Long id, @RequestBody BookCollectionRequest req) {
        BookCollection c = service.move(id, req.getParentId());
        long count = service.directMemberCounts().getOrDefault(c.getId(), 0L);
        return BookCollectionResponse.from(c, count);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/books")
    public List<BookDto> booksIn(
            @PathVariable Long id,
            @RequestParam(name = "includeDescendants", defaultValue = "false") boolean includeDescendants) {
        return bookService.toDtos(service.booksIn(id, includeDescendants));
    }

    @GetMapping("/for-book/{bookId}")
    public List<Long> collectionsForBook(@PathVariable Long bookId) {
        return service.collectionIdsForBook(bookId);
    }

    @PostMapping("/{id}/books/{bookId}")
    public ResponseEntity<Void> addBook(@PathVariable Long id, @PathVariable Long bookId) {
        service.addBook(id, bookId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/books/{bookId}")
    public ResponseEntity<Void> removeBook(@PathVariable Long id, @PathVariable Long bookId) {
        service.removeBook(id, bookId);
        return ResponseEntity.noContent().build();
    }
}
