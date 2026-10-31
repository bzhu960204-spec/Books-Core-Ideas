package com.bookscoreideas.controller;

import com.bookscoreideas.dto.PartRequest;
import com.bookscoreideas.entity.Part;
import com.bookscoreideas.repository.BookRepository;
import com.bookscoreideas.repository.PartRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/books/{bookId}/parts")
public class PartController {

    private final PartRepository partRepository;
    private final BookRepository bookRepository;

    public PartController(PartRepository partRepository, BookRepository bookRepository) {
        this.partRepository = partRepository;
        this.bookRepository = bookRepository;
    }

    @GetMapping
    public List<Part> getParts(@PathVariable Long bookId) {
        return partRepository.findByBookIdOrderByOrderIndexAsc(bookId);
    }

    @PostMapping
    public ResponseEntity<Part> createPart(@PathVariable Long bookId, @Valid @RequestBody PartRequest request) {
        return bookRepository.findById(bookId).map(book -> {
            Part part = new Part();
            part.setTitle(request.title());
            part.setOrderIndex(request.orderIndex());
            part.setSummary(request.summary());
            part.setBook(book);
            return ResponseEntity.ok(partRepository.save(part));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{partId}")
    public ResponseEntity<Part> updatePart(@PathVariable Long bookId,
                                            @PathVariable Long partId,
                                            @Valid @RequestBody PartRequest request) {
        return partRepository.findByIdAndBookId(partId, bookId).map(existing -> {
            existing.setTitle(request.title());
            existing.setOrderIndex(request.orderIndex());
            existing.setSummary(request.summary());
            return ResponseEntity.ok(partRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{partId}")
    public ResponseEntity<Void> deletePart(@PathVariable Long bookId, @PathVariable Long partId) {
        return partRepository.findByIdAndBookId(partId, bookId).map(part -> {
            partRepository.delete(part);
            return ResponseEntity.ok().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }
}
