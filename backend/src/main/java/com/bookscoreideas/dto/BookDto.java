package com.bookscoreideas.dto;

import com.bookscoreideas.entity.Book;
import com.bookscoreideas.entity.ReadingStatus;
import com.bookscoreideas.entity.StructureType;

import java.time.LocalDate;

/**
 * A book as returned by the /api/books endpoints and collection listings: every
 * stored field plus the number of chapters, but not the chapter tree itself
 * (chapters are fetched per book from /api/books/{id}/chapters). All editable
 * fields are included because clients send a listed book back to PUT.
 */
public record BookDto(
        Long id,
        String title,
        String author,
        String isbn,
        String description,
        String coverUrl,
        LocalDate dateAdded,
        Integer rating,
        String category,
        ReadingStatus readingStatus,
        LocalDate startDate,
        LocalDate finishDate,
        Boolean chapterImagesEnabled,
        StructureType structureType,
        long chapterCount) {

    public static BookDto from(Book book, long chapterCount) {
        return new BookDto(
                book.getId(),
                book.getTitle(),
                book.getAuthor(),
                book.getIsbn(),
                book.getDescription(),
                book.getCoverUrl(),
                book.getDateAdded(),
                book.getRating(),
                book.getCategory(),
                book.getReadingStatus(),
                book.getStartDate(),
                book.getFinishDate(),
                book.getChapterImagesEnabled(),
                book.getStructureType(),
                chapterCount);
    }
}
