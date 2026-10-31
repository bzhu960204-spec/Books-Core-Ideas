package com.bookscoreideas.service;

import com.bookscoreideas.dto.BookDto;
import com.bookscoreideas.dto.CreateBookRequest;
import com.bookscoreideas.dto.UpdateBookRequest;
import com.bookscoreideas.entity.Book;
import com.bookscoreideas.repository.BookCollectionItemRepository;
import com.bookscoreideas.repository.BookRepository;
import com.bookscoreideas.repository.ChapterRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class BookService {

    private final BookRepository bookRepository;
    private final ChapterRepository chapterRepository;
    private final BookCollectionItemRepository collectionItemRepository;

    public BookService(BookRepository bookRepository,
                       ChapterRepository chapterRepository,
                       BookCollectionItemRepository collectionItemRepository) {
        this.bookRepository = bookRepository;
        this.chapterRepository = chapterRepository;
        this.collectionItemRepository = collectionItemRepository;
    }

    @Transactional(readOnly = true)
    public List<BookDto> list() {
        return toDtos(bookRepository.findAll());
    }

    @Transactional(readOnly = true)
    public Optional<BookDto> get(Long id) {
        return bookRepository.findById(id).map(this::toDto);
    }

    /** Books as DTOs with their chapter counts, in one count query regardless of size. */
    @Transactional(readOnly = true)
    public List<BookDto> toDtos(List<Book> books) {
        if (books.isEmpty()) return List.of();
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : chapterRepository.countByBookIds(books.stream().map(Book::getId).toList())) {
            counts.put((Long) row[0], (Long) row[1]);
        }
        return books.stream()
                .map(book -> BookDto.from(book, counts.getOrDefault(book.getId(), 0L)))
                .toList();
    }

    private BookDto toDto(Book book) {
        return BookDto.from(book, chapterRepository.countByBookId(book.getId()));
    }

    @Transactional
    public BookDto create(CreateBookRequest request) {
        Book book = new Book();
        book.setTitle(request.title());
        book.setAuthor(request.author());
        book.setIsbn(request.isbn());
        book.setDescription(request.description());
        book.setCoverUrl(request.coverUrl());
        book.setDateAdded(request.dateAdded());
        book.setRating(request.rating());
        book.setCategory(request.category());
        book.setReadingStatus(request.readingStatus());
        book.setStartDate(request.startDate());
        book.setFinishDate(request.finishDate());
        if (request.chapterImagesEnabled() != null) {
            book.setChapterImagesEnabled(request.chapterImagesEnabled());
        }
        if (request.structureType() != null) {
            book.setStructureType(request.structureType());
        }
        return BookDto.from(bookRepository.save(book), 0);
    }

    @Transactional
    public Optional<BookDto> update(Long id, UpdateBookRequest request) {
        return bookRepository.findById(id).map(existing -> {
            existing.setTitle(request.title());
            existing.setAuthor(request.author());
            existing.setIsbn(request.isbn());
            existing.setDescription(request.description());
            existing.setCoverUrl(request.coverUrl());
            existing.setRating(request.rating());
            existing.setCategory(request.category());
            existing.setReadingStatus(request.readingStatus());
            existing.setStartDate(request.startDate());
            existing.setFinishDate(request.finishDate());
            existing.setChapterImagesEnabled(Boolean.TRUE.equals(request.chapterImagesEnabled()));
            if (request.structureType() != null) {
                existing.setStructureType(request.structureType());
            }
            return toDto(bookRepository.save(existing));
        });
    }

    /**
     * Deletes a book with everything it owns (parts, chapters and their content,
     * reviews, image files) and its collection memberships, in one transaction.
     *
     * @return false if the book does not exist
     */
    @Transactional
    public boolean delete(Long id) {
        return bookRepository.findById(id).map(book -> {
            collectionItemRepository.deleteByBookId(id);
            bookRepository.delete(book);
            return true;
        }).orElse(false);
    }
}
