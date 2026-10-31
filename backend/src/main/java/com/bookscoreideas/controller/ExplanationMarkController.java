package com.bookscoreideas.controller;

import com.bookscoreideas.dto.MarkDto;
import com.bookscoreideas.service.MarkService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ExplanationMarkController {

    private final MarkService markService;

    public ExplanationMarkController(MarkService markService) {
        this.markService = markService;
    }

    @PostMapping("/chapters/{chapterId}/marks")
    public ResponseEntity<MarkDto> create(@PathVariable Long chapterId,
                                          @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = body != null ? body : Map.of();
        Object quote = payload.get("quote");
        if (quote == null || quote.toString().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        var mark = new MarkService.NewMark(quote.toString(), text(payload.get("prefix")), text(payload.get("suffix")),
                integer(payload.get("startOffset")), integer(payload.get("endOffset")), text(payload.get("note")));
        return ResponseEntity.of(markService.create(chapterId, mark));
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
                                              @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = body != null ? body : Map.of();
        return ResponseEntity.of(markService.updateNote(id, text(payload.get("note"))));
    }

    @DeleteMapping("/marks/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return markService.delete(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    private static String text(Object value) {
        return value != null ? value.toString() : null;
    }

    private static Integer integer(Object value) {
        return value instanceof Number number ? Integer.valueOf(number.intValue()) : null;
    }
}