package com.bookscoreideas.repository;

import com.bookscoreideas.dto.ExcerptSearchResult;
import com.bookscoreideas.entity.Excerpt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ExcerptRepository extends JpaRepository<Excerpt, Long> {

    List<Excerpt> findByChapterIdOrderByOrderIndexAsc(Long chapterId);

    @Query("""
            SELECT new com.bookscoreideas.dto.ExcerptSearchResult(
                e.id, e.content, e.note, e.source, e.orderIndex,
                c.id, c.title, b.id, b.title, b.author
            )
            FROM Excerpt e
            JOIN e.chapter c
            JOIN c.book b
            WHERE (:q IS NULL OR :q = '' OR
                   LOWER(CAST(e.content AS String)) LIKE LOWER(CONCAT('%', CAST(:q AS String), '%')) OR
                   LOWER(COALESCE(e.note, '')) LIKE LOWER(CONCAT('%', CAST(:q AS String), '%')) OR
                   LOWER(b.title) LIKE LOWER(CONCAT('%', CAST(:q AS String), '%')) OR
                   LOWER(c.title) LIKE LOWER(CONCAT('%', CAST(:q AS String), '%')))
            AND (:bookId IS NULL OR b.id = :bookId)
            AND e.highlighted = true
            ORDER BY b.title ASC, c.orderIndex ASC, e.orderIndex ASC
            """)
    List<ExcerptSearchResult> searchExcerpts(@Param("q") String q,
                                             @Param("bookId") Long bookId);
}
