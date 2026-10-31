package com.bookscoreideas.controller;

import com.bookscoreideas.dto.MarkDto;
import com.bookscoreideas.dto.MarkNoteRequest;
import com.bookscoreideas.dto.MarkRequest;
import com.bookscoreideas.service.MarkService;
import com.bookscoreideas.web.Responses;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ExplanationMarkController {

    private final MarkService markService;

    public ExplanationMarkController(MarkService markService) {
        this.markService = markService;
    }

    @PostMapping("/chapters/{chapterId}/marks")
    public ResponseEntity<MarkDto> create(@PathVariable Long chapterId, @Valid @RequestBody MarkRequest body) {
        var mark = new MarkService.NewMark(body.quote(), body.prefix(), body.suffix(),
                body.startOffset(), body.endOffset(), body.note());
        return Responses.created(markService.create(chapterId, mark), "Chapter", chapterId);
    }

    @GetMapping("/books/{bookId}/marks")
    public List<MarkDto> listByBook(@PathVariable Long bookId) {
        return markService.listByBook(bookId);
    }

    @GetMapping("/chapters/{chapterId}/marks")
    public List<MarkDto> listByChapter(@PathVariable Long chapterId) {
        return markService.listByChapter(chapterId);
    }

    @PatchMapping("/marks/{id}")
    public ResponseEntity<MarkDto> updateNote(@PathVariable Long id,
                                              @RequestBody(required = false) MarkNoteRequest body) {
        return Responses.ok(markService.updateNote(id, body != null ? body.note() : null), "Mark", id);
    }

    @DeleteMapping("/marks/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return Responses.deleted(markService.delete(id), "Mark", id);
    }
}
