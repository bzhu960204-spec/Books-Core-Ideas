package com.bookscoreideas.repository;

import com.bookscoreideas.entity.Book;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface BookRepository extends JpaRepository<Book, Long> {
    // Fetch all categories (will be split client-side)
    // Each book.category can contain multiple categories separated by semicolon
    @Query("SELECT DISTINCT b.category FROM Book b WHERE b.category IS NOT NULL AND b.category <> ''")
    List<String> findRawCategories();
    
    // Extract and return distinct individual categories (Java implementation)
    default List<String> findDistinctCategories() {
        return findRawCategories().stream()
            .flatMap(cat -> java.util.Arrays.stream(cat.split(";")))
            .map(String::trim)
            .filter(cat -> !cat.isEmpty())
            .distinct()
            .sorted()
            .toList();
    }
}
