package com.bookscoreideas.repository;

import com.bookscoreideas.dto.IdeaSearchResult;
import com.bookscoreideas.entity.KeyIdea;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface KeyIdeaRepository extends JpaRepository<KeyIdea, Long> {

    List<KeyIdea> findByChapterIdOrderByOrderIndexAsc(Long chapterId);

    @Query("""
            SELECT new com.bookscoreideas.dto.IdeaSearchResult(
                ki.id, ki.content, ki.example, ki.tags, ki.orderIndex,
                c.id, c.title, b.id, b.title, b.author
            )
            FROM KeyIdea ki
            JOIN ki.chapter c
            JOIN c.book b
            WHERE (:q IS NULL OR :q = '' OR
                   LOWER(ki.content) LIKE LOWER(CONCAT('%', :q, '%')) OR
                   LOWER(COALESCE(ki.example, '')) LIKE LOWER(CONCAT('%', :q, '%')) OR
                   LOWER(b.title) LIKE LOWER(CONCAT('%', :q, '%')) OR
                   LOWER(c.title) LIKE LOWER(CONCAT('%', :q, '%')))
            AND (:bookId IS NULL OR b.id = :bookId)
            AND (:tag IS NULL OR :tag = '' OR LOWER(COALESCE(ki.tags, '')) LIKE LOWER(CONCAT('%', :tag, '%')))
            AND ki.highlighted = true
            ORDER BY b.title ASC, c.orderIndex ASC, ki.orderIndex ASC
            """)
    List<IdeaSearchResult> searchIdeas(@Param("q") String q,
                                       @Param("bookId") Long bookId,
                                       @Param("tag") String tag);
}

