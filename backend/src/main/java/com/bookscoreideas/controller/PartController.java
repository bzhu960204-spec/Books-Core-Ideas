package com.bookscoreideas.controller;

import com.bookscoreideas.dto.PartDto;
import com.bookscoreideas.dto.PartRequest;
import com.bookscoreideas.service.PartService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/books/{bookId}/parts")
public class PartController {

    private final PartService partService;

    public PartController(PartService partService) {
        this.partService = partService;
    }

    @GetMapping
    public List<PartDto> getParts(@PathVariable Long bookId) {
        return partService.list(bookId);
    }

    @PostMapping
    public ResponseEntity<PartDto> createPart(@PathVariable Long bookId, @Valid @RequestBody PartRequest request) {
        return ResponseEntity.of(partService.create(bookId, request));
    }

    @PutMapping("/{partId}")
    public ResponseEntity<PartDto> updatePart(@PathVariable Long bookId,
                                              @PathVariable Long partId,
                                              @Valid @RequestBody PartRequest request) {
        return ResponseEntity.of(partService.update(bookId, partId, request));
    }

    @DeleteMapping("/{partId}")
    public ResponseEntity<Void> deletePart(@PathVariable Long bookId, @PathVariable Long partId) {
        return partService.delete(bookId, partId)
                ? ResponseEntity.ok().build()
                : ResponseEntity.notFound().build();
    }
}
