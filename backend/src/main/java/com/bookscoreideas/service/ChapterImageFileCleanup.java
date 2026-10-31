package com.bookscoreideas.service;

import com.bookscoreideas.entity.ChapterImage;
import jakarta.persistence.PostRemove;

/**
 * JPA listener that removes an image's file whenever its ChapterImage row is
 * deleted, whether directly or via cascade from a chapter, part or book.
 * Instantiated by Hibernate through Spring's bean container, so the storage
 * dependency is constructor-injected.
 */
public class ChapterImageFileCleanup {

    private final ChapterImageStorage storage;

    public ChapterImageFileCleanup(ChapterImageStorage storage) {
        this.storage = storage;
    }

    @PostRemove
    public void afterRemove(ChapterImage image) {
        storage.deleteAfterCommit(image.getFilename());
    }
}
