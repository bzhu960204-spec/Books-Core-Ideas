package com.bookscoreideas.repository;

import com.bookscoreideas.entity.ChapterImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ChapterImageRepository extends JpaRepository<ChapterImage, Long> {
    List<ChapterImage> findByChapterIdOrderByOrderIndexAsc(Long chapterId);
    int countByChapterId(Long chapterId);
    Optional<ChapterImage> findByIdAndChapterId(Long id, Long chapterId);

    /** Rows of [chapterId, imageCount] for a book's chapters; chapters without images are absent. */
    @Query("SELECT i.chapter.id, COUNT(i) FROM ChapterImage i WHERE i.chapter.book.id = :bookId GROUP BY i.chapter.id")
    List<Object[]> countByBookId(@Param("bookId") Long bookId);
}
