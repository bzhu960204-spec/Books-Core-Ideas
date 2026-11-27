package com.bookscoreideas.repository;

import com.bookscoreideas.entity.ChapterFavorite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ChapterFavoriteRepository extends JpaRepository<ChapterFavorite, Long> {

    Optional<ChapterFavorite> findByChapterId(Long chapterId);

    @Query("select f.chapter.id from ChapterFavorite f where f.book.id = :bookId")
    List<Long> findChapterIdsByBookId(@Param("bookId") Long bookId);

    /** Columns for the favorites list, joined in one query instead of loading entities per row. */
    interface FavoriteRow {
        Long getId();
        Long getChapterId();
        String getChapterTitle();
        Integer getChapterOrderIndex();
        String getChapterSummary();
        boolean getHasExplanation();
        Long getBookId();
        String getBookTitle();
        String getBookAuthor();
        String getBookCoverUrl();
        String getNote();
        LocalDateTime getCreatedAt();
    }

    /**
     * Newest first; all books when {@code bookId} is null. {@code q} matches the chapter
     * title and summary, the book title and author, and the note (case-insensitive).
     */
    @Query("""
            SELECT f.id AS id, c.id AS chapterId, c.title AS chapterTitle, c.orderIndex AS chapterOrderIndex,
                   c.summary AS chapterSummary,
                   CASE WHEN EXISTS (SELECT 1 FROM ChapterExplanation e WHERE e.chapter = c)
                        THEN true ELSE false END AS hasExplanation,
                   bk.id AS bookId, bk.title AS bookTitle, bk.author AS bookAuthor, bk.coverUrl AS bookCoverUrl,
                   f.note AS note, f.createdAt AS createdAt
            FROM ChapterFavorite f JOIN f.chapter c JOIN f.book bk
            WHERE (:bookId IS NULL OR bk.id = :bookId)
            AND (:q IS NULL OR :q = '' OR
                 LOWER(c.title) LIKE LOWER(CONCAT('%', CAST(:q AS String), '%')) OR
                 LOWER(COALESCE(CAST(c.summary AS String), '')) LIKE LOWER(CONCAT('%', CAST(:q AS String), '%')) OR
                 LOWER(bk.title) LIKE LOWER(CONCAT('%', CAST(:q AS String), '%')) OR
                 LOWER(COALESCE(bk.author, '')) LIKE LOWER(CONCAT('%', CAST(:q AS String), '%')) OR
                 LOWER(COALESCE(f.note, '')) LIKE LOWER(CONCAT('%', CAST(:q AS String), '%')))
            ORDER BY f.createdAt DESC, f.id DESC
            """)
    List<FavoriteRow> findRows(@Param("bookId") Long bookId, @Param("q") String q);
}
