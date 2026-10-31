package com.bookscoreideas.service;

import com.bookscoreideas.repository.BookCollectionItemRepository;
import com.bookscoreideas.repository.BookRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookService {

    private final BookRepository bookRepository;
    private final BookCollectionItemRepository collectionItemRepository;

    public BookService(BookRepository bookRepository,
                       BookCollectionItemRepository collectionItemRepository) {
        this.bookRepository = bookRepository;
        this.collectionItemRepository = collectionItemRepository;
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
