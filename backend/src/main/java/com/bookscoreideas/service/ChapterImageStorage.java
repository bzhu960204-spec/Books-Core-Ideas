package com.bookscoreideas.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;

/**
 * Owns the on-disk directory for uploaded chapter images: resolves stored
 * filenames safely (no path traversal) and deletes files once the database
 * change that removed them has committed.
 */
@Component
public class ChapterImageStorage {

    private static final Logger log = LoggerFactory.getLogger(ChapterImageStorage.class);

    private final Path uploadDir;

    public ChapterImageStorage(@Value("${app.upload.dir:./data/images}") String uploadPath) {
        this.uploadDir = Paths.get(uploadPath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.uploadDir);
        } catch (IOException e) {
            throw new IllegalStateException("Could not create upload directory " + this.uploadDir, e);
        }
    }

    public Path uploadDir() {
        return uploadDir;
    }

    /** Resolves a stored filename inside the upload directory; empty if invalid. */
    public Optional<Path> resolve(String filename) {
        if (filename == null || filename.isBlank()) return Optional.empty();
        Path path = uploadDir.resolve(filename).normalize();
        return path.startsWith(uploadDir) && !path.equals(uploadDir) ? Optional.of(path) : Optional.empty();
    }

    /**
     * Deletes the file after the current transaction commits, so a rolled-back
     * delete never loses the file. Without a transaction, deletes immediately.
     */
    public void deleteAfterCommit(String filename) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    deleteNow(filename);
                }
            });
        } else {
            deleteNow(filename);
        }
    }

    private void deleteNow(String filename) {
        resolve(filename).ifPresent(path -> {
            try {
                Files.deleteIfExists(path);
            } catch (IOException e) {
                log.warn("Could not delete image file {}", path, e);
            }
        });
    }
}
