package com.bookscoreideas.controller;

import com.bookscoreideas.dto.migration.ExportRequestDto;
import com.bookscoreideas.dto.migration.ImportPreviewDto;
import com.bookscoreideas.dto.migration.ImportResultDto;
import com.bookscoreideas.service.MigrationService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/migration")
public class MigrationController {

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
        try (var in = open(file)) {
            return migrationService.previewArchive(in);
        } catch (IOException e) {
            throw new IllegalArgumentException("Could not read archive: " + e.getMessage(), e);
        }
    }

    // 200, not 201: the response is a per-book report (some may be skipped or fail).
    @PostMapping("/import")
    public ImportResultDto importArchive(@RequestParam("file") MultipartFile file) {
        try (var in = open(file)) {
            return migrationService.importArchive(in);
        } catch (IOException e) {
            throw new IllegalArgumentException("Could not read archive: " + e.getMessage(), e);
        }
    }

    private static InputStream open(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("No file provided.");
        }
        return file.getInputStream();
    }
}
