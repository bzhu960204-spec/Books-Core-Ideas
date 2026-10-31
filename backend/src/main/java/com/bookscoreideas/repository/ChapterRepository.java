package com.bookscoreideas.repository;

import com.bookscoreideas.entity.Chapter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ChapterRepository extends JpaRepository<Chapter, Long> {
    List<Chapter> findByBookIdOrderByOrderIndexAsc(Long bookId);
    List<Chapter> findByPart_IdOrderByOrderIndexAsc(Long partId);
    Optional<Chapter> findByIdAndBookId(Long id, Long bookId);

    long countByBookId(Long bookId);

    /** Rows of [bookId, chapterCount]; books without chapters are absent. */
    @Query("SELECT c.book.id, COUNT(c) FROM Chapter c WHERE c.book.id IN :bookIds GROUP BY c.book.id")
    List<Object[]> countByBookIds(@Param("bookIds") Collection<Long> bookIds);
}
