package com.bookscoreideas.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

@Entity
@Table(name = "chapter_explanations",
        uniqueConstraints = @UniqueConstraint(name = "uk_chapter_explanations_chapter", columnNames = {"chapter_id"}))
public class ChapterExplanation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // One explanation per chapter; the unique constraint above enforces 0:1.
    @OneToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "chapter_id", nullable = false, unique = true)
    @JsonIgnore
    private Chapter chapter;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String content;

    private LocalDateTime updatedAt;

    // Imports bring the original time; everything else gets "now" (DB-06: a timestamp,
    // to the column's microsecond precision so the saved value reads back the same).
    @PrePersist
    protected void onCreate() {
        if (updatedAt == null) updatedAt = now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = now();
    }

    private static LocalDateTime now() {
        return LocalDateTime.now().truncatedTo(ChronoUnit.MICROS);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Chapter getChapter() { return chapter; }
    public void setChapter(Chapter chapter) { this.chapter = chapter; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
