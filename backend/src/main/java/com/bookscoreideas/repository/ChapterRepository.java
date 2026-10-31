package com.bookscoreideas.repository;

import com.bookscoreideas.entity.Chapter;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ChapterRepository extends JpaRepository<Chapter, Long> {
    List<Chapter> findByBookIdOrderByOrderIndexAsc(Long bookId);
    List<Chapter> findByPart_IdOrderByOrderIndexAsc(Long partId);
    Optional<Chapter> findByIdAndBookId(Long id, Long bookId);
}
