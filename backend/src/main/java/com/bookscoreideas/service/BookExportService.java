package com.bookscoreideas.service;

import com.bookscoreideas.dto.migration.BookArchiveDto;
import com.bookscoreideas.dto.migration.ChapterArchiveDto;
import com.bookscoreideas.dto.migration.ExcerptArchiveDto;
import com.bookscoreideas.dto.migration.KeyIdeaArchiveDto;
import com.bookscoreideas.dto.migration.PartArchiveDto;
import com.bookscoreideas.repository.BookRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Single-book JSON export (the "Export JSON" button). Its shape is the documented
 * JSON import format (see README), so it stays as it is: a subset of the archive
 * snapshot (no explanation, images, reviews, bookmarks, marks or collections), read
 * through the same {@link BookArchiveBuilder} as the ZIP migration.
 */
@Service
public class BookExportService {

    private final BookRepository bookRepository;
    private final BookArchiveBuilder archiveBuilder;

    public BookExportService(BookRepository bookRepository, BookArchiveBuilder archiveBuilder) {
        this.bookRepository = bookRepository;
        this.archiveBuilder = archiveBuilder;
    }

    /** @return empty if the book does not exist */
    @Transactional(readOnly = true)
    public Optional<Map<String, Object>> export(Long bookId) {
        return bookRepository.findById(bookId).map(book -> {
            BookArchiveDto archive = archiveBuilder.build(book);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("title", archive.title());
            result.put("author", archive.author());
            result.put("isbn", archive.isbn());
            result.put("description", archive.description());
            result.put("category", archive.category());
            result.put("rating", archive.rating());
            result.put("readingStatus", archive.readingStatus());
            result.put("dateAdded", archive.dateAdded());
            // As stored (the archive normalises unknown values to CHAPTERS).
            result.put("structureType", book.getStructureType());
            if (archive.parts() != null) {
                result.put("parts", archive.parts().stream().map(BookExportService::part).toList());
            } else {
                result.put("chapters", chapters(archive.chapters()));
            }
            return result;
        });
    }

    private static Map<String, Object> part(PartArchiveDto part) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("title", part.title());
        map.put("orderIndex", part.orderIndex());
        map.put("summary", part.summary());
        map.put("chapters", chapters(part.chapters()));
        return map;
    }

    private static List<Map<String, Object>> chapters(List<ChapterArchiveDto> chapters) {
        return chapters.stream().map(BookExportService::chapter).toList();
    }

    private static Map<String, Object> chapter(ChapterArchiveDto chapter) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("title", chapter.title());
        map.put("orderIndex", chapter.orderIndex());
        map.put("summary", chapter.summary());
        map.put("keyIdeas", chapter.keyIdeas().stream().map(BookExportService::idea).toList());
        map.put("excerpts", chapter.excerpts().stream().map(BookExportService::excerpt).toList());
        return map;
    }

    private static Map<String, Object> idea(KeyIdeaArchiveDto idea) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("content", idea.content());
        map.put("example", idea.example());
        map.put("tags", idea.tags());
        map.put("highlighted", idea.highlighted());
        map.put("orderIndex", idea.orderIndex());
        return map;
    }

    private static Map<String, Object> excerpt(ExcerptArchiveDto excerpt) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("content", excerpt.content());
        map.put("note", excerpt.note());
        map.put("source", excerpt.source());
        map.put("highlighted", excerpt.highlighted());
        map.put("orderIndex", excerpt.orderIndex());
        return map;
    }
}
