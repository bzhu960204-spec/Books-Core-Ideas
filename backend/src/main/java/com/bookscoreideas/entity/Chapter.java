package com.bookscoreideas.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "chapters")
public class Chapter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    private String title;

    private Integer orderIndex;

    @Column(length = 1000)
    private String summary;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "book_id")
    @JsonIgnore
    private Book book;

    // Optional grouping layer: when a book uses the "PARTS" structure, each
    // chapter belongs to a Part. For plain "CHAPTERS" books this stays null.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "part_id")
    @JsonIgnore
    private Part part;

    // Transient carrier so the API can read/write the owning part by id without
    // exposing the full Part relationship.
    @Transient
    private Long partId;

    @OneToMany(mappedBy = "chapter", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    private List<KeyIdea> keyIdeas = new ArrayList<>();

    @OneToMany(mappedBy = "chapter", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    @JsonIgnore
    private List<Excerpt> excerpts = new ArrayList<>();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public Integer getOrderIndex() { return orderIndex; }
    public void setOrderIndex(Integer orderIndex) { this.orderIndex = orderIndex; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public Book getBook() { return book; }
    public void setBook(Book book) { this.book = book; }
    @JsonIgnore
    public Part getPart() { return part; }
    @JsonIgnore
    public void setPart(Part part) { this.part = part; }
    public Long getPartId() { return part != null ? part.getId() : partId; }
    public void setPartId(Long partId) { this.partId = partId; }
    public List<KeyIdea> getKeyIdeas() { return keyIdeas; }
    public void setKeyIdeas(List<KeyIdea> keyIdeas) { this.keyIdeas = keyIdeas; }
    public List<Excerpt> getExcerpts() { return excerpts; }
    public void setExcerpts(List<Excerpt> excerpts) { this.excerpts = excerpts; }
}
