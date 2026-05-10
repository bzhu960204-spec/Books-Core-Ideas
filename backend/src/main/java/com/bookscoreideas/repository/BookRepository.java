package com.bookscoreideas.repository;

import com.bookscoreideas.entity.Book;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookRepository extends JpaRepository<Book, Long> {
}
