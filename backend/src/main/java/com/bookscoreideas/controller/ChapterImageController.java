package com.bookscoreideas.controller;

import com.bookscoreideas.dto.ChapterImageDto;
import com.bookscoreideas.dto.ImageUploadDto;
import com.bookscoreideas.service.ChapterImageService;
import com.bookscoreideas.service.ChapterImageService.StoredImage;
import com.bookscoreideas.web.NotFoundException;
import com.bookscoreideas.web.Responses;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/chapters/{chapterId}/images")
public class ChapterImageController {

    private final ChapterImageService imageService;

    public ChapterImageController(ChapterImageService imageService) {
        this.imageService = imageService;
    }

    @GetMapping
    public List<ChapterImageDto> getImages(@PathVariable Long chapterId) {
        return imageService.list(chapterId);
    }

    /** 201 with the report if anything was saved; 200 if nothing was (every file is in {@code skipped}). */
    @PostMapping
    public ResponseEntity<ImageUploadDto> uploadImages(@PathVariable Long chapterId,
                                                       @RequestParam("files") MultipartFile[] files) {
        ImageUploadDto report = imageService.upload(chapterId, files)
                .orElseThrow(() -> NotFoundException.of("Chapter", chapterId));
        return report.images().isEmpty() ? ResponseEntity.ok(report) : Responses.created(report);
    }

    /**
     * Supported images are shown inline with their real type. Anything else (only possible for
     * rows stored before SEC-02 or imported from an archive) is a download the browser cannot
     * render. Either way: no type sniffing, and no scripts even if opened as a page.
     */
    @GetMapping("/{imageId}/data")
    public ResponseEntity<Resource> getImageData(@PathVariable Long chapterId,
                                                 @PathVariable Long imageId) {
        return imageService.open(chapterId, imageId)
                .map(image -> ResponseEntity.ok()
                        .contentType(image.type().map(t -> MediaType.parseMediaType(t.contentType()))
                                .orElse(MediaType.APPLICATION_OCTET_STREAM))
                        .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(image).toString())
                        .header("X-Content-Type-Options", "nosniff")
                        // inline styles: the browser's own image viewer when opened in a tab
                        .header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
                        .<Resource>body(new FileSystemResource(image.path())))
                .orElseThrow(() -> NotFoundException.of("Image", imageId));
    }

    private static ContentDisposition contentDisposition(StoredImage image) {
        ContentDisposition.Builder builder = image.type().isPresent()
                ? ContentDisposition.inline() : ContentDisposition.attachment();
        String name = image.originalName() == null ? "" : image.originalName().replaceAll("\\p{Cntrl}", "");
        if (name.isBlank()) return builder.build();
        boolean ascii = StandardCharsets.US_ASCII.newEncoder().canEncode(name);
        return (ascii ? builder.filename(name) : builder.filename(name, StandardCharsets.UTF_8)).build();
    }

    @DeleteMapping("/{imageId}")
    public ResponseEntity<Void> deleteImage(@PathVariable Long chapterId,
                                            @PathVariable Long imageId) {
        return Responses.deleted(imageService.delete(chapterId, imageId), "Image", imageId);
    }
}