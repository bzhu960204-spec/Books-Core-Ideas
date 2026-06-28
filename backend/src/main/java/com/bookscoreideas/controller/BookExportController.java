package com.bookscoreideas.controller;

import com.bookscoreideas.entity.Book;
import com.bookscoreideas.entity.Chapter;
import com.bookscoreideas.entity.Excerpt;
import com.bookscoreideas.entity.KeyIdea;
import com.bookscoreideas.entity.Part;
import com.bookscoreideas.repository.BookRepository;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.ExcerptRepository;
import com.bookscoreideas.repository.KeyIdeaRepository;
import com.bookscoreideas.repository.PartRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/books/{bookId}/export")
public class BookExportController {

    private final BookRepository bookRepository;
    private final ChapterRepository chapterRepository;
    private final KeyIdeaRepository keyIdeaRepository;
    private final ExcerptRepository excerptRepository;
    private final PartRepository partRepository;

    public BookExportController(BookRepository bookRepository, ChapterRepository chapterRepository,
                                 KeyIdeaRepository keyIdeaRepository, ExcerptRepository excerptRepository,
                                 PartRepository partRepository) {
        this.bookRepository = bookRepository;
        this.chapterRepository = chapterRepository;
        this.keyIdeaRepository = keyIdeaRepository;
        this.excerptRepository = excerptRepository;
        this.partRepository = partRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> exportBook(@PathVariable Long bookId) {
        return bookRepository.findById(bookId).map(book -> {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("title", book.getTitle());
            result.put("author", book.getAuthor());
            result.put("isbn", book.getIsbn());
            result.put("description", book.getDescription());
            result.put("category", book.getCategory());
            result.put("rating", book.getRating());
            result.put("readingStatus", book.getReadingStatus());
            result.put("dateAdded", book.getDateAdded() != null ? book.getDateAdded().toString() : null);
            result.put("structureType", book.getStructureType());

            if ("PARTS".equals(book.getStructureType())) {
                List<Part> parts = partRepository.findByBookIdOrderByOrderIndexAsc(book.getId());
                List<Map<String, Object>> partsExport = new ArrayList<>();
                for (Part part : parts) {
                    Map<String, Object> partMap = new LinkedHashMap<>();
                    partMap.put("title", part.getTitle());
                    partMap.put("orderIndex", part.getOrderIndex());
                    partMap.put("summary", part.getSummary());

                    List<Chapter> chapters = chapterRepository.findByPart_IdOrderByOrderIndexAsc(part.getId());
                    List<Map<String, Object>> chaptersExport = new ArrayList<>();
                    for (Chapter chapter : chapters) {
                        chaptersExport.add(exportChapter(chapter));
                    }
                    partMap.put("chapters", chaptersExport);
                    partsExport.add(partMap);
                }
                result.put("parts", partsExport);
            } else {
                List<Chapter> chapters = chapterRepository.findByBookIdOrderByOrderIndexAsc(book.getId());
                List<Map<String, Object>> chaptersExport = new ArrayList<>();
                for (Chapter chapter : chapters) {
                    chaptersExport.add(exportChapter(chapter));
                }
                result.put("chapters", chaptersExport);
            }

            return ResponseEntity.ok(result);
        }).orElse(ResponseEntity.notFound().build());
    }

    private Map<String, Object> exportChapter(Chapter chapter) {
        Map<String, Object> chapterMap = new LinkedHashMap<>();
        chapterMap.put("title", chapter.getTitle());
        chapterMap.put("orderIndex", chapter.getOrderIndex());
        chapterMap.put("summary", chapter.getSummary());

        List<KeyIdea> ideas = keyIdeaRepository.findByChapterIdOrderByOrderIndexAsc(chapter.getId());
        List<Map<String, Object>> ideasExport = new ArrayList<>();
        for (KeyIdea idea : ideas) {
            Map<String, Object> ideaMap = new LinkedHashMap<>();
            ideaMap.put("content", idea.getContent());
            ideaMap.put("example", idea.getExample());
            ideaMap.put("tags", idea.getTags());
            ideaMap.put("highlighted", idea.isHighlighted());
            ideaMap.put("orderIndex", idea.getOrderIndex());
            ideasExport.add(ideaMap);
        }
        chapterMap.put("keyIdeas", ideasExport);

        List<Excerpt> excerpts = excerptRepository.findByChapterIdOrderByOrderIndexAsc(chapter.getId());
        List<Map<String, Object>> excerptsExport = new ArrayList<>();
        for (Excerpt excerpt : excerpts) {
            Map<String, Object> excerptMap = new LinkedHashMap<>();
            excerptMap.put("content", excerpt.getContent());
            excerptMap.put("note", excerpt.getNote());
            excerptMap.put("source", excerpt.getSource());
            excerptMap.put("highlighted", excerpt.isHighlighted());
            excerptMap.put("orderIndex", excerpt.getOrderIndex());
            excerptsExport.add(excerptMap);
        }
        chapterMap.put("excerpts", excerptsExport);

        return chapterMap;
    }
}
