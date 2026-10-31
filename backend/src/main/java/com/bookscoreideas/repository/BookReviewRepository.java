package com.bookscoreideas.repository;

import com.bookscoreideas.entity.BookReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface BookReviewRepository extends JpaRepository<BookReview, Long> {
    List<BookReview> findByBookIdOrderByUpdatedAtDescIdDesc(Long bookId);

    /** All reviews with their (eagerly mapped) book fetched in the same query. */
    @Query("SELECT r FROM BookReview r JOIN FETCH r.book ORDER BY r.updatedAt DESC, r.id DESC")
    List<BookReview> findAllWithBook();
}