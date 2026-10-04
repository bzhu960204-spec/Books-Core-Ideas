package com.bookscoreideas.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Join row linking a {@link Book} into a {@link BookCollection}. A book may
 * belong to multiple collections; the unique constraint prevents duplicates.
 */
@Entity
@Table(
        name = "book_collection_items",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_book_collection_items",
                columnNames = {"collection_id", "book_id"})
)
public class BookCollectionItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "collection_id", nullable = false)
    private Long collectionId;

    @Column(name = "book_id", nullable = false)
    private Long bookId;

    private LocalDateTime addedAt;

    @PrePersist
    protected void onCreate() {
        addedAt = LocalDateTime.now();
    }

    public BookCollectionItem() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getCollectionId() { return collectionId; }
    public void setCollectionId(Long collectionId) { this.collectionId = collectionId; }

    public Long getBookId() { return bookId; }
    public void setBookId(Long bookId) { this.bookId = bookId; }

    public LocalDateTime getAddedAt() { return addedAt; }
    public void setAddedAt(LocalDateTime addedAt) { this.addedAt = addedAt; }
}
