package com.bookscoreideas.repository;

import com.bookscoreideas.entity.Chapter;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ChapterRepository extends JpaRepository<Chapter, Long> {
    List<Chapter> findByBookIdOrderByOrderIndexAsc(Long bookId);
    List<Chapter> findByPart_IdOrderByOrderIndexAsc(Long partId);
}
