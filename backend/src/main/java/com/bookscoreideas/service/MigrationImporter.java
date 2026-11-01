package com.bookscoreideas.service;

import com.bookscoreideas.dto.SkippedFile;
import com.bookscoreideas.dto.migration.BookArchiveDto;
import com.bookscoreideas.dto.migration.ChapterArchiveDto;
import com.bookscoreideas.dto.migration.PartArchiveDto;
import com.bookscoreideas.dto.migration.ReviewArchiveDto;
import com.bookscoreideas.entity.Book;
import com.bookscoreideas.entity.BookReview;
import com.bookscoreideas.entity.Part;
import com.bookscoreideas.entity.ReadingStatus;
import com.bookscoreideas.entity.StructureType;
import com.bookscoreideas.repository.BookRepository;
import com.bookscoreideas.repository.BookReviewRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

import static com.bookscoreideas.service.BookTreeWriter.parseDate;
import static com.bookscoreideas.service.BookTreeWriter.parseDateTime;

/**
 * Persists a single imported book inside its own transaction so that a failure
 * on one book rolls back only that book, not the whole archive. Image files are
 * written within that transaction and deleted again if it rolls back (BE-07).
 * Called within an outer transaction (JSON import), it joins it instead.
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

    /** @param skippedImages images in the archive that were not imported, with the reason (SEC-04) */
    public record PersistOutcome(Long bookId, int chaptersImported, int imagesImported,
                                 List<SkippedFile> skippedImages) {}

    @Transactional
    public PersistOutcome persistBook(BookArchiveDto dto, BookTreeWriter.ImageSource images) {
        Book book = new Book();
        book.setTitle(dto.title());
        book.setAuthor(dto.author());
        book.setIsbn(dto.isbn());
        book.setDescription(dto.description());
        book.setCoverUrl(dto.coverUrl());
        book.setRating(dto.rating());
        book.setCategory(dto.category());
        book.setReadingStatus(ReadingStatus.fromTextOrNull(dto.readingStatus()));
        book.setDateAdded(parseDate(dto.dateAdded()));
        book.setStartDate(parseDate(dto.startDate()));
        book.setFinishDate(parseDate(dto.finishDate()));
        book.setChapterImagesEnabled(dto.chapterImagesEnabled() != null ? dto.chapterImagesEnabled() : false);
        book.setStructureType(StructureType.fromTextOrDefault(dto.structureType()));
        boolean isParts = book.isPartsBook();
        book = bookRepository.save(book);

        List<String> storedImages = new ArrayList<>();
        List<SkippedFile> skippedImages = new ArrayList<>();
        int chapterCount = 0;

        if (isParts && dto.parts() != null) {
            for (PartArchiveDto partDto : dto.parts()) {
                Part part = treeWriter.writePart(book, partDto);
                if (partDto.chapters() != null) {
                    for (ChapterArchiveDto chDto : partDto.chapters()) {
                        treeWriter.writeChapter(book, part, chDto, images, storedImages, skippedImages);
                        chapterCount++;
                    }
                }
            }
        }
        // Chapters outside any part: all of a CHAPTERS book's, or a PARTS book's ungrouped ones.
        if (dto.chapters() != null) {
            for (ChapterArchiveDto chDto : dto.chapters()) {
                treeWriter.writeChapter(book, null, chDto, images, storedImages, skippedImages);
                chapterCount++;
            }
        }

        if (dto.reviews() != null) {
            for (ReviewArchiveDto reviewDto : dto.reviews()) {
                BookReview review = new BookReview();
                review.setBook(book);
                review.setTitle(reviewDto.title());
                review.setContent(reviewDto.content());
                review.setUpdatedAt(parseDateTime(reviewDto.updatedAt()));
                reviewRepository.save(review);
            }
        }

        if (dto.collectionPaths() != null) {
            for (List<String> path : dto.collectionPaths()) {
                collectionService.addBook(collectionService.findOrCreatePath(path).getId(), book.getId());
            }
        }

        return new PersistOutcome(book.getId(), chapterCount, storedImages.size(), skippedImages);
    }
}
