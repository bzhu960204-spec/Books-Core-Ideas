package com.bookscoreideas.service;

import com.bookscoreideas.dto.BookDto;
import com.bookscoreideas.dto.ExcerptRequest;
import com.bookscoreideas.dto.KeyIdeaRequest;
import com.bookscoreideas.dto.jsonimport.BookImport;
import com.bookscoreideas.dto.jsonimport.BookImportRequest;
import com.bookscoreideas.dto.jsonimport.ChapterContentImport;
import com.bookscoreideas.dto.jsonimport.ChapterImport;
import com.bookscoreideas.dto.jsonimport.ContentImportRequest;
import com.bookscoreideas.dto.jsonimport.ImportMode;
import com.bookscoreideas.dto.jsonimport.ImportSummaryDto;
import com.bookscoreideas.dto.jsonimport.PartImport;
import com.bookscoreideas.dto.jsonimport.StructureImportRequest;
import com.bookscoreideas.dto.migration.BookArchiveDto;
import com.bookscoreideas.dto.migration.ChapterArchiveDto;
import com.bookscoreideas.dto.migration.ExcerptArchiveDto;
import com.bookscoreideas.dto.migration.KeyIdeaArchiveDto;
import com.bookscoreideas.dto.migration.PartArchiveDto;
import com.bookscoreideas.entity.Book;
import com.bookscoreideas.entity.Chapter;
import com.bookscoreideas.entity.Part;
import com.bookscoreideas.repository.BookRepository;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.ExcerptRepository;
import com.bookscoreideas.repository.KeyIdeaRepository;
import com.bookscoreideas.repository.PartRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * JSON import (FE-08): the library's "Import JSON" and the book page's import tabs.
 * Each request is one transaction, so a failure leaves nothing half-imported; the
 * rows are written by the same {@link BookTreeWriter} as the ZIP migration.
 */
@Service
public class JsonImportService {

    private final MigrationImporter migrationImporter;
    private final BookTreeWriter treeWriter;
    private final BookService bookService;
    private final BookRepository bookRepository;
    private final PartRepository partRepository;
    private final ChapterRepository chapterRepository;
    private final KeyIdeaRepository keyIdeaRepository;
    private final ExcerptRepository excerptRepository;

    public JsonImportService(MigrationImporter migrationImporter, BookTreeWriter treeWriter, BookService bookService,
                             BookRepository bookRepository, PartRepository partRepository,
                             ChapterRepository chapterRepository, KeyIdeaRepository keyIdeaRepository,
                             ExcerptRepository excerptRepository) {
        this.migrationImporter = migrationImporter;
        this.treeWriter = treeWriter;
        this.bookService = bookService;
        this.bookRepository = bookRepository;
        this.partRepository = partRepository;
        this.chapterRepository = chapterRepository;
        this.keyIdeaRepository = keyIdeaRepository;
        this.excerptRepository = excerptRepository;
    }

    /** Creates every book with its parts, chapters, ideas and excerpts; all or none. */
    @Transactional
    public List<BookDto> importBooks(BookImportRequest request) {
        List<Long> ids = new ArrayList<>();
        for (BookImport book : request.books()) {
            ids.add(migrationImporter.persistBook(archive(book), Map.of()).bookId());
        }
        Map<Long, Book> created = bookRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Book::getId, Function.identity()));
        return bookService.toDtos(ids.stream().map(created::get).toList());
    }

    /** @return empty if the book does not exist */
    @Transactional
    public Optional<ImportSummaryDto> importStructure(Long bookId, StructureImportRequest request) {
        return bookRepository.findById(bookId).map(book -> {
            List<PartImport> parts = request.parts() != null ? request.parts() : List.of();
            List<ChapterImport> chapters = request.chapters() != null ? request.chapters() : List.of();
            if (!"PARTS".equals(book.getStructureType()) && !parts.isEmpty()) {
                throw new IllegalArgumentException("parts: this book has no parts (structure CHAPTERS); "
                        + "import \"chapters\", or switch the book to Parts → Chapters first");
            }
            if (ImportMode.isReplace(request.mode())) {
                deleteStructure(bookId);
            }
            Counter count = new Counter();
            for (PartImport partImport : parts) {
                Part part = treeWriter.writePart(book, new PartArchiveDto(
                        partImport.title(), partImport.orderIndex(), partImport.summary(), null));
                count.parts++;
                for (ChapterImport chapter : orEmpty(partImport.chapters())) {
                    writeChapter(book, part, chapter, count);
                }
            }
            for (ChapterImport chapter : chapters) {
                writeChapter(book, null, chapter, count);
            }
            return count.summary();
        });
    }

    /** @return empty if the book does not exist */
    @Transactional
    public Optional<ImportSummaryDto> importContent(Long bookId, ContentImportRequest request) {
        return bookRepository.findById(bookId).map(book -> {
            List<Chapter> bookChapters = chapterRepository.findByBookIdOrderByOrderIndexAsc(bookId);
            List<Chapter> targets = new ArrayList<>();
            for (int i = 0; i < request.chapters().size(); i++) {
                targets.add(resolve(bookChapters, request.chapters().get(i), "chapters[" + i + "]"));
            }
            if (ImportMode.isReplace(request.mode())) {
                // Each chapter is cleared once, before anything is added, even if it is named twice.
                Set<Long> clearIdeas = new LinkedHashSet<>();
                Set<Long> clearExcerpts = new LinkedHashSet<>();
                for (int i = 0; i < targets.size(); i++) {
                    ChapterContentImport entry = request.chapters().get(i);
                    if (entry.ideas() != null) clearIdeas.add(targets.get(i).getId());
                    if (entry.excerpts() != null) clearExcerpts.add(targets.get(i).getId());
                }
                for (Long id : clearIdeas) {
                    keyIdeaRepository.deleteAll(keyIdeaRepository.findByChapterIdOrderByOrderIndexAsc(id));
                }
                for (Long id : clearExcerpts) {
                    excerptRepository.deleteAll(excerptRepository.findByChapterIdOrderByOrderIndexAsc(id));
                }
            }
            Counter count = new Counter();
            for (int i = 0; i < targets.size(); i++) {
                ChapterContentImport entry = request.chapters().get(i);
                for (KeyIdeaRequest idea : orEmpty(entry.ideas())) {
                    treeWriter.writeIdea(targets.get(i), idea(idea));
                    count.ideas++;
                }
                for (ExcerptRequest excerpt : orEmpty(entry.excerpts())) {
                    treeWriter.writeExcerpt(targets.get(i), excerpt(excerpt));
                    count.excerpts++;
                }
            }
            return count.summary();
        });
    }

    // Parts first (their chapters go with them), then the remaining ungrouped chapters;
    // entity deletes so chapter image files are removed after commit.
    private void deleteStructure(Long bookId) {
        partRepository.deleteAll(partRepository.findByBookIdOrderByOrderIndexAsc(bookId));
        partRepository.flush();
        chapterRepository.deleteAll(chapterRepository.findByBookIdOrderByOrderIndexAsc(bookId));
        chapterRepository.flush();
    }

    private Chapter resolve(List<Chapter> chapters, ChapterContentImport entry, String path) {
        if (entry.ideas() == null && entry.excerpts() == null) {
            throw new IllegalArgumentException(path + ": nothing to import (no \"ideas\" or \"excerpts\")");
        }
        if (entry.chapterId() != null) {
            return chapters.stream().filter(c -> c.getId().equals(entry.chapterId())).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException(
                            path + ".chapterId: chapter " + entry.chapterId() + " is not in this book"));
        }
        if (entry.chapter() == null || entry.chapter().isBlank()) {
            throw new IllegalArgumentException(path + ": name the chapter by title (\"chapter\") or id (\"chapterId\")");
        }
        String wanted = normalize(entry.chapter());
        return chapters.stream().filter(c -> normalize(c.getTitle()).equals(wanted)).findFirst()
                .or(() -> chapters.stream().filter(c -> normalize(c.getTitle()).contains(wanted)).findFirst())
                .orElseThrow(() -> new IllegalArgumentException("Chapter not found: \"" + entry.chapter()
                        + "\". Make sure the chapter title matches."));
    }

    private void writeChapter(Book book, Part part, ChapterImport chapter, Counter count) {
        treeWriter.writeChapter(book, part, chapter(chapter), Map.of(), new ArrayList<>(), new ArrayList<>());
        count.chapters++;
        count.ideas += orEmpty(chapter.keyIdeas()).size();
        count.excerpts += orEmpty(chapter.excerpts()).size();
    }

    private static BookArchiveDto archive(BookImport book) {
        boolean isParts = book.isPartsBook();
        List<PartArchiveDto> parts = isParts
                ? orEmpty(book.parts()).stream().map(p -> new PartArchiveDto(p.title(), p.orderIndex(), p.summary(),
                        orEmpty(p.chapters()).stream().map(JsonImportService::chapter).toList())).toList()
                : null;
        List<ChapterArchiveDto> chapters = book.chapters() != null
                ? book.chapters().stream().map(JsonImportService::chapter).toList()
                : null;
        return new BookArchiveDto(MigrationService.FORMAT_VERSION, book.title(), book.author(), book.isbn(),
                book.description(), book.coverUrl(), book.rating(), book.category(), book.readingStatus(),
                text(book.dateAdded()), text(book.startDate()), text(book.finishDate()), book.chapterImagesEnabled(),
                isParts ? "PARTS" : "CHAPTERS", parts, chapters, null, null);
    }

    private static ChapterArchiveDto chapter(ChapterImport chapter) {
        return new ChapterArchiveDto(chapter.title(), chapter.orderIndex(), chapter.summary(), null,
                orEmpty(chapter.keyIdeas()).stream().map(JsonImportService::idea).toList(),
                orEmpty(chapter.excerpts()).stream().map(JsonImportService::excerpt).toList(),
                null, null, null);
    }

    private static KeyIdeaArchiveDto idea(KeyIdeaRequest idea) {
        return new KeyIdeaArchiveDto(idea.content(), idea.example(), idea.tags(), idea.highlighted(), idea.orderIndex());
    }

    private static ExcerptArchiveDto excerpt(ExcerptRequest excerpt) {
        return new ExcerptArchiveDto(excerpt.content(), excerpt.note(), excerpt.source(), excerpt.highlighted(),
                excerpt.orderIndex());
    }

    private static String normalize(String title) {
        return title == null ? "" : title.trim().toLowerCase(Locale.ROOT);
    }

    private static <T> List<T> orEmpty(List<T> list) {
        return list != null ? list : List.of();
    }

    private static String text(Object value) {
        return Objects.toString(value, null);
    }

    private static final class Counter {
        int parts;
        int chapters;
        int ideas;
        int excerpts;

        ImportSummaryDto summary() {
            return new ImportSummaryDto(parts, chapters, ideas, excerpts);
        }
    }
}
