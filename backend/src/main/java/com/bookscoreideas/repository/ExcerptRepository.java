package com.bookscoreideas.repository;

import com.bookscoreideas.entity.Excerpt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExcerptRepository extends JpaRepository<Excerpt, Long> {
    List<Excerpt> findByChapterIdOrderByOrderIndexAsc(Long chapterId);
}
