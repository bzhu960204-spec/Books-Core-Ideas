package com.bookscoreideas.repository;

import com.bookscoreideas.entity.ExplanationMark;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ExplanationMarkRepository extends JpaRepository<ExplanationMark, Long> {

    void deleteByChapterId(Long chapterId);

    /** Columns for listing saved passages, joined in one query instead of loading entities per row. */
    interface MarkRow {
        Long getId();
        Long getBookId();
        String getBookTitle();
        Long getChapterId();
        String getChapterTitle();
        Integer getChapterOrderIndex();
        String getQuote();
        String getPrefix();
        String getSuffix();
        Integer getStartOffset();
        Integer getEndOffset();
        String getNote();
        LocalDateTime getCreatedAt();
        LocalDateTime getUpdatedAt();
    }

    String MARK_ROW_SELECT = """
            SELECT m.id AS id, bk.id AS bookId, bk.title AS bookTitle,
                   c.id AS chapterId, c.title AS chapterTitle, c.orderIndex AS chapterOrderIndex,
                   m.quote AS quote, m.prefix AS prefix, m.suffix AS suffix,
                   m.startOffset AS startOffset, m.endOffset AS endOffset, m.note AS note,
                   m.createdAt AS createdAt, m.updatedAt AS updatedAt
            FROM ExplanationMark m JOIN m.chapter c JOIN m.book bk
            """;

    @Query(MARK_ROW_SELECT + "WHERE bk.id = :bookId ORDER BY c.orderIndex ASC, m.startOffset ASC, m.id ASC")
    List<MarkRow> findRowsByBookId(@Param("bookId") Long bookId);

    @Query(MARK_ROW_SELECT + "WHERE c.id = :chapterId ORDER BY m.startOffset ASC, m.id ASC")
    List<MarkRow> findRowsByChapterId(@Param("chapterId") Long chapterId);
}