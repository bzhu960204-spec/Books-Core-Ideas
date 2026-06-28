package com.bookscoreideas.repository;

import com.bookscoreideas.entity.Part;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PartRepository extends JpaRepository<Part, Long> {
    List<Part> findByBookIdOrderByOrderIndexAsc(Long bookId);
}
