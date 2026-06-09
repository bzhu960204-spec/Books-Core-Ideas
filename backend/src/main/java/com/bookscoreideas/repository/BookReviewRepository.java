package com.bookscoreideas.repository;

import com.bookscoreideas.entity.BookReview;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BookReviewRepository extends JpaRepository<BookReview, Long> {
    Optional<BookReview> findByBookId(Long bookId);
    List<BookReview> findAllByOrderByUpdatedAtDesc();
}
