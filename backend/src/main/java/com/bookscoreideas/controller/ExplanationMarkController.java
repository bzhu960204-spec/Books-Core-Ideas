package com.bookscoreideas.controller;

import com.bookscoreideas.entity.Book;
import com.bookscoreideas.entity.Chapter;
import com.bookscoreideas.entity.ExplanationMark;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.ExplanationMarkRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// Saved passages ("marks") from chapter explanations. Each mark stores the
// selected text and locating context so the reader can jump back to it.
@RestController
@RequestMapping("/api")
public class ExplanationMarkController {

    private static final int MAX_CONTEXT = 200;
    private static final int MAX_NOTE = 1000;

    private final ExplanationMarkRepository markRepository;
    private final ChapterRepository chapterRepository;

    public ExplanationMarkController(ExplanationMarkRepository markRepository,
                                     ChapterRepository chapterRepository) {
        this.markRepository = markRepository;
        this.chapterRepository = chapterRepository;
    }

    @PostMapping("/chapters/{chapterId}/marks")
    @Transactional
    public ResponseEntity<Map<String, Object>> create(@PathVariable Long chapterId,
                                                       @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = body != null ? body : Map.of();
        Object quote = payload.get("quote");
        if (quote == null || quote.toString().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return chapterRepository.findById(chapterId).map(chapter -> {
            ExplanationMark mark = new ExplanationMark();
            mark.setChapter(chapter);
            mark.setBook(chapter.getBook());
            mark.setQuote(quote.toString());
            mark.setPrefix(truncate(payload.get("prefix"), MAX_CONTEXT));
            mark.setSuffix(truncate(payload.get("suffix"), MAX_CONTEXT));
            mark.setStartOffset(toInt(payload.get("startOffset")));
            mark.setEndOffset(toInt(payload.get("endOffset")));
            mark.setNote(normalizeNote(payload.get("note")));
            markRepository.save(mark);
            return ResponseEntity.ok(toMap(mark));
        }).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/books/{bookId}/marks")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> listByBook(@PathVariable Long bookId) {
        return markRepository.findByBookIdOrderByChapter_OrderIndexAscStartOffsetAscIdAsc(bookId)
                .stream().map(this::toMap).collect(Collectors.toList());
    }

    @GetMapping("/chapters/{chapterId}/marks")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> listByChapter(@PathVariable Long chapterId) {
        return markRepository.findByChapterIdOrderByStartOffsetAscIdAsc(chapterId)
                .stream().map(this::toMap).collect(Collectors.toList());
    }

    @PatchMapping("/marks/{id}")
    @Transactional
    public ResponseEntity<Map<String, Object>> updateNote(@PathVariable Long id,
                                                           @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = body != null ? body : Map.of();
        return markRepository.findById(id).map(mark -> {
            mark.setNote(normalizeNote(payload.get("note")));
            markRepository.save(mark);
            return ResponseEntity.ok(toMap(mark));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/marks/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!markRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        markRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private static String truncate(Object value, int max) {
        if (value == null) return null;
        String text = value.toString();
        return text.length() > max ? text.substring(0, max) : text;
    }

    private static String normalizeNote(Object value) {
        if (value == null || value.toString().isBlank()) return null;
        String text = value.toString().trim();
        return text.length() > MAX_NOTE ? text.substring(0, MAX_NOTE) : text;
    }

    private static Integer toInt(Object value) {
        return value instanceof Number number ? Integer.valueOf(number.intValue()) : null;
    }

    private Map<String, Object> toMap(ExplanationMark mark) {
        Map<String, Object> map = new HashMap<>();
        Chapter chapter = mark.getChapter();
        Book book = mark.getBook();
        map.put("id", mark.getId());
        map.put("bookId", book != null ? book.getId() : null);
        map.put("bookTitle", book != null ? book.getTitle() : "");
        map.put("chapterId", chapter != null ? chapter.getId() : null);
        map.put("chapterTitle", chapter != null ? chapter.getTitle() : "");
        map.put("chapterOrderIndex", chapter != null ? chapter.getOrderIndex() : null);
        map.put("quote", mark.getQuote() != null ? mark.getQuote() : "");
        map.put("prefix", mark.getPrefix() != null ? mark.getPrefix() : "");
        map.put("suffix", mark.getSuffix() != null ? mark.getSuffix() : "");
        map.put("startOffset", mark.getStartOffset());
        map.put("endOffset", mark.getEndOffset());
        map.put("note", mark.getNote() != null ? mark.getNote() : "");
        map.put("createdAt", mark.getCreatedAt() != null ? mark.getCreatedAt().toString() : "");
        map.put("updatedAt", mark.getUpdatedAt() != null ? mark.getUpdatedAt().toString() : "");
        return map;
    }
}
