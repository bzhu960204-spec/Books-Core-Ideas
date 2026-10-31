package com.bookscoreideas.controller;

import com.bookscoreideas.dto.BookDto;
import com.bookscoreideas.dto.CreateBookRequest;
import com.bookscoreideas.dto.UpdateBookRequest;
import com.bookscoreideas.service.BookService;
import com.bookscoreideas.web.Responses;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/books")
public class BookController {

    private final BookService bookService;

    public BookController(BookService bookService) {
        this.bookService = bookService;
    }

    @GetMapping
    public List<BookDto> getAllBooks() {
        return bookService.list();
    }

    @GetMapping("/categories")
    public List<String> getCategories() {
        return bookService.categories();
    }

    @GetMapping("/{id}")
    public ResponseEntity<BookDto> getBook(@PathVariable Long id) {
        return Responses.ok(bookService.get(id), "Book", id);
    }

    @PostMapping
    public ResponseEntity<BookDto> createBook(@Valid @RequestBody CreateBookRequest request) {
        return Responses.created(bookService.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<BookDto> updateBook(@PathVariable Long id, @Valid @RequestBody UpdateBookRequest request) {
        return Responses.ok(bookService.update(id, request), "Book", id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBook(@PathVariable Long id) {
        return Responses.deleted(bookService.delete(id), "Book", id);
    }
}
