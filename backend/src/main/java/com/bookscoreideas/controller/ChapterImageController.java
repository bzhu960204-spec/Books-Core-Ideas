package com.bookscoreideas.controller;

import com.bookscoreideas.entity.ChapterImage;
import com.bookscoreideas.repository.ChapterImageRepository;
import com.bookscoreideas.repository.ChapterRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/chapters/{chapterId}/images")
public class ChapterImageController {

    private final ChapterImageRepository imageRepository;
    private final ChapterRepository chapterRepository;
    private final Path uploadDir;

    public ChapterImageController(ChapterImageRepository imageRepository,
                                   ChapterRepository chapterRepository,
                                   @Value("${app.upload.dir:./data/images}") String uploadPath) {
        this.imageRepository = imageRepository;
        this.chapterRepository = chapterRepository;
        this.uploadDir = Paths.get(uploadPath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.uploadDir);
        } catch (IOException e) {
            throw new RuntimeException("Could not create upload directory", e);
        }
    }

    @GetMapping
    public List<ChapterImage> getImages(@PathVariable Long chapterId) {
        return imageRepository.findByChapterIdOrderByOrderIndexAsc(chapterId);
    }

    @PostMapping
    public ResponseEntity<List<ChapterImage>> uploadImages(@PathVariable Long chapterId,
                                                            @RequestParam("files") MultipartFile[] files) {
        return chapterRepository.findById(chapterId).map(chapter -> {
            List<ChapterImage> saved = new ArrayList<>();
            int currentCount = imageRepository.countByChapterId(chapterId);
            for (int i = 0; i < files.length; i++) {
                MultipartFile file = files[i];
                if (file.isEmpty()) continue;

                String contentType = file.getContentType();
                if (contentType == null || !contentType.startsWith("image/")) continue;

                String ext = getExtension(file.getOriginalFilename());
                String filename = UUID.randomUUID().toString() + ext;

                try {
                    Path target = uploadDir.resolve(filename).normalize();
                    if (!target.startsWith(uploadDir)) {
                        continue; // path traversal protection
                    }
                    Files.copy(file.getInputStream(), target);

                    ChapterImage image = new ChapterImage();
                    image.setFilename(filename);
                    image.setOriginalName(file.getOriginalFilename());
                    image.setContentType(contentType);
                    image.setOrderIndex(currentCount + i + 1);
                    image.setChapter(chapter);
                    saved.add(imageRepository.save(image));
                } catch (IOException e) {
                    // skip failed files
                }
            }
            return ResponseEntity.ok(saved);
        }).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{imageId}/data")
    public ResponseEntity<Resource> getImageData(@PathVariable Long chapterId,
                                                  @PathVariable Long imageId) {
        return imageRepository.findById(imageId).map(image -> {
            try {
                Path filePath = uploadDir.resolve(image.getFilename()).normalize();
                if (!filePath.startsWith(uploadDir)) {
                    return ResponseEntity.badRequest().<Resource>build();
                }
                Resource resource = new UrlResource(filePath.toUri());
                if (!resource.exists()) {
                    return ResponseEntity.notFound().<Resource>build();
                }
                return ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(image.getContentType()))
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + image.getOriginalName() + "\"")
                        .body(resource);
            } catch (Exception e) {
                return ResponseEntity.internalServerError().<Resource>build();
            }
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{imageId}")
    public ResponseEntity<Void> deleteImage(@PathVariable Long chapterId,
                                             @PathVariable Long imageId) {
        return imageRepository.findById(imageId).map(image -> {
            try {
                Path filePath = uploadDir.resolve(image.getFilename()).normalize();
                if (filePath.startsWith(uploadDir)) {
                    Files.deleteIfExists(filePath);
                }
            } catch (IOException e) {
                // file may already be gone
            }
            imageRepository.delete(image);
            return ResponseEntity.ok().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }

    private String getExtension(String filename) {
        if (filename == null) return "";
        int dotIndex = filename.lastIndexOf('.');
        return dotIndex >= 0 ? filename.substring(dotIndex) : "";
    }
}
