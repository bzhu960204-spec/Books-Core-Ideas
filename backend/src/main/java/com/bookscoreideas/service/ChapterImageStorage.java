package com.bookscoreideas.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.IOException;
import java.io.InputStream;
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

    /** Resolves a stored filename inside the upload directory; empty if invalid. */
    public Optional<Path> resolve(String filename) {
        if (filename == null || filename.isBlank()) return Optional.empty();
        Path path = uploadDir.resolve(filename).normalize();
        return path.startsWith(uploadDir) && !path.equals(uploadDir) ? Optional.of(path) : Optional.empty();
    }

    /** The file stored under this name, if the name is valid and the file exists. */
    public Optional<Path> existing(String filename) {
        return resolve(filename).filter(Files::isRegularFile);
    }

    /**
     * Copies a new file into the directory; fails if the file already exists.
     * @return false if the name would escape the upload directory
     */
    public boolean store(String filename, InputStream content) throws IOException {
        Optional<Path> target = resolve(filename);
        if (target.isEmpty()) return false;
        Files.copy(content, target.get());
        return true;
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

    /**
     * Deletes a newly written file if the current transaction rolls back, so a failed
     * upload or import leaves no file without a database row. Without a transaction, does nothing.
     */
    public void deleteIfRolledBack(String filename) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) deleteNow(filename);
            }
        });
    }

    /** Deletes a file right away, e.g. one left half-written by a failed write. */
    public void deleteNow(String filename) {
        resolve(filename).ifPresent(path -> {
            try {
                Files.deleteIfExists(path);
            } catch (IOException e) {
                log.warn("Could not delete image file {}", path, e);
            }
        });
    }
}
