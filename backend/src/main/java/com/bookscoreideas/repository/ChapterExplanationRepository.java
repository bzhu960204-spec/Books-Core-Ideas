package com.bookscoreideas.repository;

import com.bookscoreideas.entity.ChapterExplanation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ChapterExplanationRepository extends JpaRepository<ChapterExplanation, Long> {
    Optional<ChapterExplanation> findByChapterId(Long chapterId);

    @Query("select e.chapter.id from ChapterExplanation e where e.chapter.book.id = :bookId")
    List<Long> findChapterIdsByBookId(@Param("bookId") Long bookId);
}
