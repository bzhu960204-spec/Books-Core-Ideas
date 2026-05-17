package com.bookscoreideas.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;

@Entity
@Table(name = "excerpts")
public class Excerpt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Lob
    @Column(columnDefinition = "CLOB")
    private String content;

    @Column(length = 1000)
    private String note;

    @Column(length = 300)
    private String source;

    private Integer orderIndex;

    private boolean highlighted = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chapter_id")
    @JsonIgnore
    private Chapter chapter;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public Integer getOrderIndex() { return orderIndex; }
    public void setOrderIndex(Integer orderIndex) { this.orderIndex = orderIndex; }
    public boolean isHighlighted() { return highlighted; }
    public void setHighlighted(boolean highlighted) { this.highlighted = highlighted; }
    public Chapter getChapter() { return chapter; }
    public void setChapter(Chapter chapter) { this.chapter = chapter; }
}
