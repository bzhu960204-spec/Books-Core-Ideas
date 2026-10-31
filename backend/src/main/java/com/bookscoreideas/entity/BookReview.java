package com.bookscoreideas.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "book_reviews")
public class BookReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "book_id", nullable = false)
    private Book book;

    private String title;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String content;

    private LocalDate updatedAt;

    // Imports bring the original date; everything else gets "now".
    @PrePersist
    protected void onCreate() {
        if (updatedAt == null) updatedAt = LocalDate.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDate.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Book getBook() { return book; }
    public void setBook(Book book) { this.book = book; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public LocalDate getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDate updatedAt) { this.updatedAt = updatedAt; }
}
