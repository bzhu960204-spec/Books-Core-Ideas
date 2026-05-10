package com.bookscoreideas.repository;

import com.bookscoreideas.entity.KeyIdea;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface KeyIdeaRepository extends JpaRepository<KeyIdea, Long> {
    List<KeyIdea> findByChapterIdOrderByOrderIndexAsc(Long chapterId);
}
