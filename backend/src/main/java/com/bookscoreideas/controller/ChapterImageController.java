package com.bookscoreideas.controller;

import com.bookscoreideas.dto.ChapterImageDto;
import com.bookscoreideas.service.ChapterImageService;
import com.bookscoreideas.web.NotFoundException;
import com.bookscoreideas.web.Responses;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

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

    @PostMapping
    public ResponseEntity<List<ChapterImageDto>> uploadImages(@PathVariable Long chapterId,
                                                              @RequestParam("files") MultipartFile[] files) {
        return Responses.created(imageService.upload(chapterId, files), "Chapter", chapterId);
    }

    @GetMapping("/{imageId}/data")
    public ResponseEntity<Resource> getImageData(@PathVariable Long chapterId,
                                                 @PathVariable Long imageId) {
        return imageService.open(chapterId, imageId)
                .map(image -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(image.contentType()))
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + image.originalName() + "\"")
                        .<Resource>body(new FileSystemResource(image.path())))
                .orElseThrow(() -> NotFoundException.of("Image", imageId));
    }

    @DeleteMapping("/{imageId}")
    public ResponseEntity<Void> deleteImage(@PathVariable Long chapterId,
                                            @PathVariable Long imageId) {
        return Responses.deleted(imageService.delete(chapterId, imageId), "Image", imageId);
    }
}