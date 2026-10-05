package com.bookscoreideas.repository;

import com.bookscoreideas.entity.ReadingBookmark;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ReadingBookmarkRepository extends JpaRepository<ReadingBookmark, Long> {

    List<ReadingBookmark> findByBookIdOrderByCreatedAtDescIdDesc(Long bookId);

    Optional<ReadingBookmark> findFirstByBookIdOrderByCreatedAtDescIdDesc(Long bookId);

    List<ReadingBookmark> findAllByOrderByCreatedAtDescIdDesc();
}
