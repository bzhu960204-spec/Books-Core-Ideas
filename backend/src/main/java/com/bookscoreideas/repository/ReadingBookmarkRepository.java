package com.bookscoreideas.repository;

import com.bookscoreideas.entity.ReadingBookmark;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ReadingBookmarkRepository extends JpaRepository<ReadingBookmark, Long> {

    Optional<ReadingBookmark> findFirstByBookIdOrderByCreatedAtDescIdDesc(Long bookId);

    /** In creation order (migration export: re-imported rows keep their relative order). */
    List<ReadingBookmark> findByChapterIdOrderByIdAsc(Long chapterId);

    /** Columns for the reading-history list, joined in one query instead of loading entities per row. */
    interface BookmarkRow {
        Long getId();
        Long getChapterId();
        String getChapterTitle();
        Long getBookId();
        String getBookTitle();
        String getBookAuthor();
        String getBookCoverUrl();
        Double getScrollRatio();
        String getNote();
        LocalDateTime getCreatedAt();
    }

    /** Newest first; all books when {@code bookId} is null. */
    @Query("""
            SELECT b.id AS id, c.id AS chapterId, c.title AS chapterTitle,
                   bk.id AS bookId, bk.title AS bookTitle, bk.author AS bookAuthor, bk.coverUrl AS bookCoverUrl,
                   b.scrollRatio AS scrollRatio, b.note AS note, b.createdAt AS createdAt
            FROM ReadingBookmark b JOIN b.chapter c JOIN b.book bk
            WHERE (:bookId IS NULL OR bk.id = :bookId)
            ORDER BY b.createdAt DESC, b.id DESC
            """)
    List<BookmarkRow> findRows(@Param("bookId") Long bookId);
}