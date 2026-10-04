package com.bookscoreideas.dto;

import com.bookscoreideas.entity.BookCollection;

public class BookCollectionResponse {
    private Long id;
    private Long parentId;
    private String name;
    private int sortOrder;
    private long bookCount;
    private String createdAt;
    private String updatedAt;

    public static BookCollectionResponse from(BookCollection c, long bookCount) {
        BookCollectionResponse r = new BookCollectionResponse();
        r.id = c.getId();
        r.parentId = c.getParentId();
        r.name = c.getName();
        r.sortOrder = c.getSortOrder();
        r.bookCount = bookCount;
        r.createdAt = c.getCreatedAt() != null ? c.getCreatedAt().toString() : null;
        r.updatedAt = c.getUpdatedAt() != null ? c.getUpdatedAt().toString() : null;
        return r;
    }

    public Long getId() { return id; }
    public Long getParentId() { return parentId; }
    public String getName() { return name; }
    public int getSortOrder() { return sortOrder; }
    public long getBookCount() { return bookCount; }
    public String getCreatedAt() { return createdAt; }
    public String getUpdatedAt() { return updatedAt; }
}
