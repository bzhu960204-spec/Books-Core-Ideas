package com.bookscoreideas.repository;

import com.bookscoreideas.entity.ExplanationMark;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExplanationMarkRepository extends JpaRepository<ExplanationMark, Long> {

    List<ExplanationMark> findByBookIdOrderByChapter_OrderIndexAscStartOffsetAscIdAsc(Long bookId);

    List<ExplanationMark> findByChapterIdOrderByStartOffsetAscIdAsc(Long chapterId);

    void deleteByChapterId(Long chapterId);
}
