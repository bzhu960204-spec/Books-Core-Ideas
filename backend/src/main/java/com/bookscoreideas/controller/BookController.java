package com.bookscoreideas.controller;

import com.bookscoreideas.dto.BookDetailDto;
import com.bookscoreideas.dto.BookDto;
import com.bookscoreideas.dto.CreateBookRequest;
import com.bookscoreideas.dto.UpdateBookRequest;
import com.bookscoreideas.service.BookDetailService;
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
    private final BookDetailService bookDetailService;

    public BookController(BookService bookService, BookDetailService bookDetailService) {
        this.bookService = bookService;
        this.bookDetailService = bookDetailService;
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

    /** The book page's data in one response (FE-03); see {@link BookDetailDto}. */
    @GetMapping("/{id}/detail")
    public ResponseEntity<BookDetailDto> getBookDetail(@PathVariable Long id) {
        return Responses.ok(bookDetailService.get(id), "Book", id);
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
