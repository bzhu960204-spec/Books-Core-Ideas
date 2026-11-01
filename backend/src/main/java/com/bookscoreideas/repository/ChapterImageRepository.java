package com.bookscoreideas.repository;

import com.bookscoreideas.entity.ChapterImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ChapterImageRepository extends JpaRepository<ChapterImage, Long> {
    List<ChapterImage> findByChapterIdOrderByOrderIndexAsc(Long chapterId);
    Optional<ChapterImage> findByIdAndChapterId(Long id, Long chapterId);

    /** The highest position in the chapter, 0 without images: new images go after it. */
    @Query("SELECT COALESCE(MAX(i.orderIndex), 0) FROM ChapterImage i WHERE i.chapter.id = :chapterId")
    int maxOrderIndex(@Param("chapterId") Long chapterId);

    /** Rows of [chapterId, imageCount] for a book's chapters; chapters without images are absent. */
    @Query("SELECT i.chapter.id, COUNT(i) FROM ChapterImage i WHERE i.chapter.book.id = :bookId GROUP BY i.chapter.id")
    List<Object[]> countByBookId(@Param("bookId") Long bookId);
}
