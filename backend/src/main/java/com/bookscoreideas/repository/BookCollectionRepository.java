package com.bookscoreideas.repository;

import com.bookscoreideas.entity.BookCollection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BookCollectionRepository extends JpaRepository<BookCollection, Long> {

    List<BookCollection> findAllByOrderBySortOrderAscNameAsc();

    Optional<BookCollection> findById(Long id);
}
