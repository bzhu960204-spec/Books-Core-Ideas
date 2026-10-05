package com.bookscoreideas.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

// A manual "I read up to here" marker placed by the reader while viewing a
// chapter's explanation. Append-only: each marker is kept so the collection
// doubles as a reading-history timeline, while the most recent one per book
// acts as the "continue reading" pointer.
@Entity
@Table(name = "reading_bookmarks")
public class ReadingBookmark {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "book_id", nullable = false)
    @JsonIgnore
    private Book book;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "chapter_id", nullable = false)
    @JsonIgnore
    private Chapter chapter;

    // Scroll position within the explanation reader as a 0..1 ratio, so the
    // reader can be restored regardless of font size or viewport changes.
    private Double scrollRatio;

    private String note;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Book getBook() { return book; }
    public void setBook(Book book) { this.book = book; }
    public Chapter getChapter() { return chapter; }
    public void setChapter(Chapter chapter) { this.chapter = chapter; }
    public Double getScrollRatio() { return scrollRatio; }
    public void setScrollRatio(Double scrollRatio) { this.scrollRatio = scrollRatio; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
