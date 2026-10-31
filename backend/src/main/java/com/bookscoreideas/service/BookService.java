package com.bookscoreideas.service;

import com.bookscoreideas.dto.CreateBookRequest;
import com.bookscoreideas.dto.UpdateBookRequest;
import com.bookscoreideas.entity.Book;
import com.bookscoreideas.repository.BookCollectionItemRepository;
import com.bookscoreideas.repository.BookRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
public class BookService {

    private final BookRepository bookRepository;
    private final BookCollectionItemRepository collectionItemRepository;

    public BookService(BookRepository bookRepository,
                       BookCollectionItemRepository collectionItemRepository) {
        this.bookRepository = bookRepository;
        this.collectionItemRepository = collectionItemRepository;
    }

    @Transactional
    public Book create(CreateBookRequest request) {
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
        return bookRepository.save(book);
    }

    @Transactional
    public Optional<Book> update(Long id, UpdateBookRequest request) {
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
            return bookRepository.save(existing);
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
