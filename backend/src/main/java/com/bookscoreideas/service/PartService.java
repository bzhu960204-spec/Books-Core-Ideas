package com.bookscoreideas.service;

import com.bookscoreideas.dto.PartDto;
import com.bookscoreideas.dto.PartRequest;
import com.bookscoreideas.entity.Part;
import com.bookscoreideas.repository.BookRepository;
import com.bookscoreideas.repository.PartRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class PartService {

    private final PartRepository partRepository;
    private final BookRepository bookRepository;

    public PartService(PartRepository partRepository, BookRepository bookRepository) {
        this.partRepository = partRepository;
        this.bookRepository = bookRepository;
    }

    @Transactional(readOnly = true)
    public List<PartDto> list(Long bookId) {
        return partRepository.findByBookIdOrderByOrderIndexAsc(bookId).stream().map(PartDto::from).toList();
    }

    /** @return empty if the book does not exist */
    @Transactional
    public Optional<PartDto> create(Long bookId, PartRequest request) {
        return bookRepository.findById(bookId).map(book -> {
            Part part = new Part();
            part.setTitle(request.title());
            part.setOrderIndex(request.orderIndex());
            part.setSummary(request.summary());
            part.setBook(book);
            return PartDto.from(partRepository.save(part));
        });
    }

    /** @return empty if the part does not exist in this book */
    @Transactional
    public Optional<PartDto> update(Long bookId, Long partId, PartRequest request) {
        return partRepository.findByIdAndBookId(partId, bookId).map(existing -> {
            existing.setTitle(request.title());
            existing.setOrderIndex(request.orderIndex());
            existing.setSummary(request.summary());
            return PartDto.from(partRepository.save(existing));
        });
    }

    /** Deletes the part and, by cascade, its chapters. @return false if not in this book */
    @Transactional
    public boolean delete(Long bookId, Long partId) {
        return partRepository.findByIdAndBookId(partId, bookId).map(part -> {
            partRepository.delete(part);
            return true;
        }).orElse(false);
    }
}
