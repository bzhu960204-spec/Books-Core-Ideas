package com.bookscoreideas.controller;

import com.bookscoreideas.dto.migration.ExportRequestDto;
import com.bookscoreideas.dto.migration.ImportPreviewDto;
import com.bookscoreideas.dto.migration.ImportResultDto;
import com.bookscoreideas.service.MigrationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import tools.jackson.core.JacksonException;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/migration")
public class MigrationController {

    private static final Logger log = LoggerFactory.getLogger(MigrationController.class);

    private final MigrationService migrationService;

    public MigrationController(MigrationService migrationService) {
        this.migrationService = migrationService;
    }

    @PostMapping("/export")
    public ResponseEntity<StreamingResponseBody> export(@RequestBody(required = false) ExportRequestDto request) {
        List<Long> bookIds = request != null ? request.bookIds() : null;
        return buildExportResponse(bookIds);
    }

    @GetMapping("/export/{bookId}")
    public ResponseEntity<StreamingResponseBody> exportOne(@PathVariable Long bookId) {
        return buildExportResponse(List.of(bookId));
    }

    private ResponseEntity<StreamingResponseBody> buildExportResponse(List<Long> bookIds) {
        String filename = "books-export-" + LocalDate.now() + ".zip";
        StreamingResponseBody body = outputStream -> migrationService.exportBooks(bookIds, outputStream);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(new MediaType("application", "zip"))
                .body(body);
    }

    // Errors (no file, not an archive, newer format) are IllegalArgumentExceptions,
    // returned as 400 ProblemDetail by GlobalExceptionHandler like everywhere else.
    @PostMapping("/import/preview")
    public ImportPreviewDto preview(@RequestParam("file") MultipartFile file) {
        return withSavedArchive(file, migrationService::previewArchive);
    }

    // 200, not 201: the response is a per-book report (some may be skipped or fail).
    @PostMapping("/import")
    public ImportResultDto importArchive(@RequestParam("file") MultipartFile file) {
        return withSavedArchive(file, migrationService::importArchive);
    }

    private interface ArchiveReader<T> {
        T read(Path zipFile) throws IOException;
    }

    /**
     * Saves the upload to a temporary file, which the service reads entry by entry instead of
     * holding the whole archive in memory (BE-07), and deletes it afterwards.
     */
    private static <T> T withSavedArchive(MultipartFile file, ArchiveReader<T> reader) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("No file provided.");
        }
        Path saved;
        try {
            saved = Files.createTempFile("bci-migration-", ".zip");
        } catch (IOException e) {
            throw new UncheckedIOException("Could not create a temporary file for the archive", e);
        }
        try {
            // A File, not a Path: for an upload already on disk, the servlet container moves it.
            file.transferTo(saved.toFile());
            return reader.read(saved);
        } catch (IOException | JacksonException e) {
            // Jackson 3's parse errors (a broken manifest.json) are unchecked; still the client's archive.
            throw new IllegalArgumentException("Could not read archive: " + e.getMessage(), e);
        } finally {
            try {
                Files.deleteIfExists(saved);
            } catch (IOException e) {
                log.warn("Could not delete temporary archive {}", saved, e);
            }
        }
    }
}
