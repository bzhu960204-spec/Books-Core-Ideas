package com.bookscoreideas.repository;

import com.bookscoreideas.entity.BookCollectionItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;

public interface BookCollectionItemRepository extends JpaRepository<BookCollectionItem, Long> {

    List<BookCollectionItem> findByCollectionIdIn(Collection<Long> collectionIds);

    List<BookCollectionItem> findByBookId(Long bookId);

    boolean existsByCollectionIdAndBookId(Long collectionId, Long bookId);

    @Transactional
    void deleteByCollectionIdAndBookId(Long collectionId, Long bookId);

    @Transactional
    void deleteByCollectionIdIn(Collection<Long> collectionIds);

    @Transactional
    void deleteByBookId(Long bookId);
}
