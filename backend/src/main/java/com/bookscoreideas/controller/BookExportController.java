package com.bookscoreideas.controller;

import com.bookscoreideas.service.BookExportService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/books/{bookId}/export")
public class BookExportController {

    private final BookExportService exportService;

    public BookExportController(BookExportService exportService) {
        this.exportService = exportService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> exportBook(@PathVariable Long bookId) {
        return ResponseEntity.of(exportService.export(bookId));
    }
}