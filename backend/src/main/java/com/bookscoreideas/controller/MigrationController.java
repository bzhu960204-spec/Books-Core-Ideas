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

    @PostMapping("/import/preview")
    public ResponseEntity<?> preview(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body("No file provided.");
        }
        try (var in = file.getInputStream()) {
            ImportPreviewDto preview = migrationService.previewArchive(in);
            return ResponseEntity.ok(preview);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (IOException e) {
            return ResponseEntity.badRequest().body("Could not read archive: " + e.getMessage());
        }
    }

    @PostMapping("/import")
    public ResponseEntity<?> importArchive(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body("No file provided.");
        }
        try (var in = file.getInputStream()) {
            ImportResultDto result = migrationService.importArchive(in);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (IOException e) {
            return ResponseEntity.badRequest().body("Could not read archive: " + e.getMessage());
        }
    }
}
