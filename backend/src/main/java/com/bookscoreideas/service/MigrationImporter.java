package com.bookscoreideas.service;

import com.bookscoreideas.dto.migration.BookArchiveDto;
import com.bookscoreideas.dto.migration.ChapterArchiveDto;
import com.bookscoreideas.dto.migration.PartArchiveDto;
import com.bookscoreideas.dto.migration.ReviewArchiveDto;
import com.bookscoreideas.entity.Book;
import com.bookscoreideas.entity.BookReview;
import com.bookscoreideas.entity.Part;
import com.bookscoreideas.repository.BookRepository;
import com.bookscoreideas.repository.BookReviewRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static com.bookscoreideas.service.BookTreeWriter.parseDate;

/**
 * Persists a single imported book inside its own transaction so that a failure
 * on one book rolls back only that book, not the whole archive. Image bytes are
 * returned (not written here) so that files only hit disk after a successful
 * commit. Called within an outer transaction (JSON import), it joins it instead.
 */
@Component
public class MigrationImporter {

    private final BookRepository bookRepository;
    private final BookReviewRepository reviewRepository;
    private final BookCollectionService collectionService;
    private final BookTreeWriter treeWriter;

    public MigrationImporter(BookRepository bookRepository, BookReviewRepository reviewRepository,
                             BookCollectionService collectionService, BookTreeWriter treeWriter) {
        this.bookRepository = bookRepository;
        this.reviewRepository = reviewRepository;
        this.collectionService = collectionService;
        this.treeWriter = treeWriter;
    }

    public record PendingImageWrite(String filename, byte[] bytes) {}

    public record PersistOutcome(Long bookId, int chaptersImported, List<PendingImageWrite> imageWrites) {}

    @Transactional
    public PersistOutcome persistBook(BookArchiveDto dto, Map<String, byte[]> imageBytesByFilename) {
        Book book = new Book();
        book.setTitle(dto.title());
        book.setAuthor(dto.author());
        book.setIsbn(dto.isbn());
        book.setDescription(dto.description());
        book.setCoverUrl(dto.coverUrl());
        book.setRating(dto.rating());
        book.setCategory(dto.category());
        book.setReadingStatus(dto.readingStatus());
        book.setDateAdded(parseDate(dto.dateAdded()));
        book.setStartDate(parseDate(dto.startDate()));
        book.setFinishDate(parseDate(dto.finishDate()));
        book.setChapterImagesEnabled(dto.chapterImagesEnabled() != null ? dto.chapterImagesEnabled() : false);
        boolean isParts = "PARTS".equals(dto.structureType());
        book.setStructureType(isParts ? "PARTS" : "CHAPTERS");
        book = bookRepository.save(book);

        List<PendingImageWrite> writes = new ArrayList<>();
        int chapterCount = 0;

        if (isParts && dto.parts() != null) {
            for (PartArchiveDto partDto : dto.parts()) {
                Part part = treeWriter.writePart(book, partDto);
                if (partDto.chapters() != null) {
                    for (ChapterArchiveDto chDto : partDto.chapters()) {
                        treeWriter.writeChapter(book, part, chDto, imageBytesByFilename, writes);
                        chapterCount++;
                    }
                }
            }
        }
        // Chapters outside any part: all of a CHAPTERS book's, or a PARTS book's ungrouped ones.
        if (dto.chapters() != null) {
            for (ChapterArchiveDto chDto : dto.chapters()) {
                treeWriter.writeChapter(book, null, chDto, imageBytesByFilename, writes);
                chapterCount++;
            }
        }

        if (dto.reviews() != null) {
            for (ReviewArchiveDto reviewDto : dto.reviews()) {
                BookReview review = new BookReview();
                review.setBook(book);
                review.setTitle(reviewDto.title());
                review.setContent(reviewDto.content());
                review.setUpdatedAt(parseDate(reviewDto.updatedAt()));
                reviewRepository.save(review);
            }
        }

        if (dto.collectionPaths() != null) {
            for (List<String> path : dto.collectionPaths()) {
                collectionService.addBook(collectionService.findOrCreatePath(path).getId(), book.getId());
            }
        }

        return new PersistOutcome(book.getId(), chapterCount, writes);
    }
}
