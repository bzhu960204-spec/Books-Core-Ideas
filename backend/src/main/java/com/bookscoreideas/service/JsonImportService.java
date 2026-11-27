package com.bookscoreideas.service;

import com.bookscoreideas.dto.BookDto;
import com.bookscoreideas.dto.jsonimport.BookImport;
import com.bookscoreideas.dto.jsonimport.BookImportRequest;
import com.bookscoreideas.dto.jsonimport.ChapterImport;
import com.bookscoreideas.dto.jsonimport.ImportMode;
import com.bookscoreideas.dto.jsonimport.ImportSummaryDto;
import com.bookscoreideas.dto.jsonimport.PartImport;
import com.bookscoreideas.dto.jsonimport.StructureImportRequest;
import com.bookscoreideas.dto.migration.BookArchiveDto;
import com.bookscoreideas.dto.migration.ChapterArchiveDto;
import com.bookscoreideas.dto.migration.PartArchiveDto;
import com.bookscoreideas.entity.Book;
import com.bookscoreideas.entity.Part;
import com.bookscoreideas.repository.BookRepository;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.PartRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
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

    public JsonImportService(MigrationImporter migrationImporter, BookTreeWriter treeWriter, BookService bookService,
                             BookRepository bookRepository, PartRepository partRepository,
                             ChapterRepository chapterRepository) {
        this.migrationImporter = migrationImporter;
        this.treeWriter = treeWriter;
        this.bookService = bookService;
        this.bookRepository = bookRepository;
        this.partRepository = partRepository;
        this.chapterRepository = chapterRepository;
    }

    /** Creates every book with its parts and chapters; all or none. */
    @Transactional
    public List<BookDto> importBooks(BookImportRequest request) {
        List<Long> ids = new ArrayList<>();
        for (BookImport book : request.books()) {
            ids.add(migrationImporter.persistBook(archive(book), BookTreeWriter.ImageSource.NONE).bookId());
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
            if (!book.isPartsBook() && !parts.isEmpty()) {
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

    // Parts first (their chapters go with them), then the remaining ungrouped chapters;
    // entity deletes so chapter image files are removed after commit.
    private void deleteStructure(Long bookId) {
        partRepository.deleteAll(partRepository.findByBookIdOrderByOrderIndexAsc(bookId));
        partRepository.flush();
        chapterRepository.deleteAll(chapterRepository.findByBookIdOrderByOrderIndexAsc(bookId));
        chapterRepository.flush();
    }

    private void writeChapter(Book book, Part part, ChapterImport chapter, Counter count) {
        treeWriter.writeChapter(book, part, chapter(chapter), BookTreeWriter.ImageSource.NONE,
                new ArrayList<>(), new ArrayList<>());
        count.chapters++;
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
                null, null, null, null);
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

        ImportSummaryDto summary() {
            return new ImportSummaryDto(parts, chapters);
        }
    }
}
