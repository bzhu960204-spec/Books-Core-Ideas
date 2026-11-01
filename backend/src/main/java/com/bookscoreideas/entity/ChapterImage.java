package com.bookscoreideas.entity;

import com.bookscoreideas.service.ChapterImageFileCleanup;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "chapter_images")
@EntityListeners(ChapterImageFileCleanup.class)
public class ChapterImage {

    /** Width of original_name. The name comes from someone's file, not from a form, so it is cut, not rejected. */
    public static final int ORIGINAL_NAME_LENGTH = 255;

    public static String fitOriginalName(String name) {
        return name == null || name.length() <= ORIGINAL_NAME_LENGTH ? name : name.substring(0, ORIGINAL_NAME_LENGTH);
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String filename;

    private String originalName;

    private String contentType;

    private Integer orderIndex;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "chapter_id", nullable = false)
    @JsonIgnore
    private Chapter chapter;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getFilename() { return filename; }
    public void setFilename(String filename) { this.filename = filename; }
    public String getOriginalName() { return originalName; }
    public void setOriginalName(String originalName) { this.originalName = originalName; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public Integer getOrderIndex() { return orderIndex; }
    public void setOrderIndex(Integer orderIndex) { this.orderIndex = orderIndex; }
    public Chapter getChapter() { return chapter; }
    public void setChapter(Chapter chapter) { this.chapter = chapter; }
}
