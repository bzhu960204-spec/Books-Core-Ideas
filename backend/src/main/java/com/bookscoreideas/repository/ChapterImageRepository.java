package com.bookscoreideas.repository;

import com.bookscoreideas.entity.ChapterImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChapterImageRepository extends JpaRepository<ChapterImage, Long> {
    List<ChapterImage> findByChapterIdOrderByOrderIndexAsc(Long chapterId);
    int countByChapterId(Long chapterId);
}
