package com.bookscoreideas.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

// A chapter the reader starred because its explanation is worth re-reading.
// At most one per chapter (the unique constraint); the Favorite Chapters page
// lists them across books.
@Entity
@Table(name = "chapter_favorites",
        uniqueConstraints = @UniqueConstraint(name = "uk_chapter_favorites_chapter", columnNames = {"chapter_id"}))
public class ChapterFavorite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "book_id", nullable = false)
    @JsonIgnore
    private Book book;

    @OneToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "chapter_id", nullable = false, unique = true)
    @JsonIgnore
    private Chapter chapter;

    @Column(length = 500)
    private String note;

    private LocalDateTime createdAt;

    // Imports bring the original time; everything else gets "now".
    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now().truncatedTo(ChronoUnit.MICROS);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Book getBook() { return book; }
    public void setBook(Book book) { this.book = book; }
    public Chapter getChapter() { return chapter; }
    public void setChapter(Chapter chapter) { this.chapter = chapter; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
