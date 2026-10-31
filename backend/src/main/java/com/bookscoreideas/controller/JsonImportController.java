package com.bookscoreideas.controller;

import com.bookscoreideas.dto.BookDto;
import com.bookscoreideas.dto.jsonimport.BookImportRequest;
import com.bookscoreideas.dto.jsonimport.ContentImportRequest;
import com.bookscoreideas.dto.jsonimport.ImportSummaryDto;
import com.bookscoreideas.dto.jsonimport.StructureImportRequest;
import com.bookscoreideas.service.JsonImportService;
import com.bookscoreideas.web.Responses;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** JSON import (FE-08); each request is one transaction. See doc/api-conventions.md. */
@RestController
@RequestMapping("/api/books")
public class JsonImportController {

    private final JsonImportService importService;

    public JsonImportController(JsonImportService importService) {
        this.importService = importService;
    }

    /** New books with their content: 201 with the created books, in request order. */
    @PostMapping("/import")
    public ResponseEntity<List<BookDto>> importBooks(@Valid @RequestBody BookImportRequest request) {
        return Responses.created(importService.importBooks(request));
    }

    /** Parts and/or chapters (with their content) into an existing book. */
    @PostMapping("/{bookId}/import")
    public ResponseEntity<ImportSummaryDto> importStructure(@PathVariable Long bookId,
                                                            @Valid @RequestBody StructureImportRequest request) {
        return Responses.ok(importService.importStructure(bookId, request), "Book", bookId);
    }

    /** Key ideas and/or excerpts into existing chapters of a book. */
    @PostMapping("/{bookId}/import/content")
    public ResponseEntity<ImportSummaryDto> importContent(@PathVariable Long bookId,
                                                          @Valid @RequestBody ContentImportRequest request) {
        return Responses.ok(importService.importContent(bookId, request), "Book", bookId);
    }
}
