package com.bookscoreideas.repository;

import com.bookscoreideas.entity.BookReview;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BookReviewRepository extends JpaRepository<BookReview, Long> {
    List<BookReview> findByBookIdOrderByUpdatedAtDescIdDesc(Long bookId);
    List<BookReview> findAllByOrderByUpdatedAtDescIdDesc();
}
