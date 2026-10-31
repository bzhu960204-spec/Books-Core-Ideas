package com.bookscoreideas.service;

import com.bookscoreideas.dto.ChapterImageDto;
import com.bookscoreideas.entity.ChapterImage;
import com.bookscoreideas.repository.ChapterImageRepository;
import com.bookscoreideas.repository.ChapterRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Uploaded chapter images: database rows here, files via {@link ChapterImageStorage}. */
@Service
public class ChapterImageService {

    /** An image file ready to be served. */
    public record StoredImage(Path path, String contentType, String originalName) {
    }

    private final ChapterImageRepository imageRepository;
    private final ChapterRepository chapterRepository;
    private final ChapterImageStorage storage;

    public ChapterImageService(ChapterImageRepository imageRepository, ChapterRepository chapterRepository,
                               ChapterImageStorage storage) {
        this.imageRepository = imageRepository;
        this.chapterRepository = chapterRepository;
        this.storage = storage;
    }

    @Transactional(readOnly = true)
    public List<ChapterImageDto> list(Long chapterId) {
        return imageRepository.findByChapterIdOrderByOrderIndexAsc(chapterId).stream()
                .map(ChapterImageDto::from).toList();
    }

    /**
     * Stores every non-empty image file; other files are skipped.
     * @return empty if the chapter does not exist
     */
    @Transactional
    public Optional<List<ChapterImageDto>> upload(Long chapterId, MultipartFile[] files) {
        return chapterRepository.findById(chapterId).map(chapter -> {
            List<ChapterImageDto> saved = new ArrayList<>();
            int currentCount = imageRepository.countByChapterId(chapterId);
            for (int i = 0; i < files.length; i++) {
                MultipartFile file = files[i];
                if (file.isEmpty()) continue;

                String contentType = file.getContentType();
                if (contentType == null || !contentType.startsWith("image/")) continue;

                String filename = UUID.randomUUID() + extensionOf(file.getOriginalFilename());
                try (InputStream in = file.getInputStream()) {
                    if (!storage.store(filename, in)) continue;

                    ChapterImage image = new ChapterImage();
                    image.setFilename(filename);
                    image.setOriginalName(file.getOriginalFilename());
                    image.setContentType(contentType);
                    image.setOrderIndex(currentCount + i + 1);
                    image.setChapter(chapter);
                    saved.add(ChapterImageDto.from(imageRepository.save(image)));
                } catch (IOException e) {
                    // skip failed files (BUG-10: should be logged and reported)
                }
            }
            return saved;
        });
    }

    /** @return empty if the image is not in this chapter or its file is missing */
    @Transactional(readOnly = true)
    public Optional<StoredImage> open(Long chapterId, Long imageId) {
        return imageRepository.findByIdAndChapterId(imageId, chapterId)
                .flatMap(image -> storage.existing(image.getFilename())
                        .map(path -> new StoredImage(path, image.getContentType(), image.getOriginalName())));
    }

    /** The file itself is removed after commit by ChapterImageFileCleanup. @return false if not in this chapter */
    @Transactional
    public boolean delete(Long chapterId, Long imageId) {
        return imageRepository.findByIdAndChapterId(imageId, chapterId).map(image -> {
            imageRepository.delete(image);
            return true;
        }).orElse(false);
    }

    private static String extensionOf(String filename) {
        if (filename == null) return "";
        int dotIndex = filename.lastIndexOf('.');
        return dotIndex >= 0 ? filename.substring(dotIndex) : "";
    }
}
