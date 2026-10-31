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

    /** Columns needed to list a book's chapters, without loading Chapter entities. */
    interface ChapterRow {
        Long getId();
        String getTitle();
        Integer getOrderIndex();
        String getSummary();
        Long getPartId();
    }

    // Projection rather than entities: loading a Chapter also loads its explanation
    // (inverse one-to-one, cannot be lazy), i.e. one extra query per chapter.
    @Query("""
            SELECT c.id AS id, c.title AS title, c.orderIndex AS orderIndex,
                   c.summary AS summary, p.id AS partId
            FROM Chapter c LEFT JOIN c.part p
            WHERE c.book.id = :bookId
            ORDER BY c.orderIndex ASC
            """)
    List<ChapterRow> findRowsByBookId(@Param("bookId") Long bookId);

    /** Rows of [bookId, chapterCount]; books without chapters are absent. */
    @Query("SELECT c.book.id, COUNT(c) FROM Chapter c WHERE c.book.id IN :bookIds GROUP BY c.book.id")
    List<Object[]> countByBookIds(@Param("bookIds") Collection<Long> bookIds);
}
