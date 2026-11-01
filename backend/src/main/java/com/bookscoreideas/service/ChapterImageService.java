package com.bookscoreideas.service;

import com.bookscoreideas.dto.ChapterImageDto;
import com.bookscoreideas.dto.ImageUploadDto;
import com.bookscoreideas.dto.ImageUploadDto.SkippedFile;
import com.bookscoreideas.entity.ChapterImage;
import com.bookscoreideas.repository.ChapterImageRepository;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.web.NotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Uploaded chapter images: database rows here, files via {@link ChapterImageStorage}. */
@Service
public class ChapterImageService {

    private static final Logger log = LoggerFactory.getLogger(ChapterImageService.class);

    /** Width of chapter_images.original_name. The name comes from the client's file, so it is cut, not rejected. */
    private static final int MAX_NAME_LENGTH = 255;

    /**
     * An image file ready to be served.
     * @param type what the file's bytes actually are; empty if not a supported image
     */
    public record StoredImage(Path path, Optional<ImageType> type, String originalName) {
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
        NotFoundException.requireExists(chapterRepository.existsById(chapterId), "Chapter", chapterId);
        return imageRepository.findByChapterIdOrderByOrderIndexAsc(chapterId).stream()
                .map(ChapterImageDto::from).toList();
    }

    /**
     * Stores every file that is a supported image (by its bytes, {@link ImageType}) after the
     * chapter's last image, numbered consecutively; reports every other file with the reason.
     * @return empty if the chapter does not exist
     */
    @Transactional
    public Optional<ImageUploadDto> upload(Long chapterId, MultipartFile[] files) {
        return chapterRepository.findById(chapterId).map(chapter -> {
            List<ChapterImageDto> saved = new ArrayList<>();
            List<SkippedFile> skipped = new ArrayList<>();
            int nextIndex = imageRepository.maxOrderIndex(chapterId) + 1;
            for (MultipartFile file : files) {
                String name = file.getOriginalFilename();
                if (file.isEmpty()) {
                    skipped.add(new SkippedFile(name, SkippedFile.EMPTY));
                    continue;
                }
                Optional<StoredFile> stored = store(chapterId, file, skipped);
                if (stored.isEmpty()) continue;

                ChapterImage image = new ChapterImage();
                image.setFilename(stored.get().filename());
                image.setOriginalName(name == null ? null : name.substring(0, Math.min(name.length(), MAX_NAME_LENGTH)));
                image.setContentType(stored.get().type().contentType());
                image.setOrderIndex(nextIndex++);
                image.setChapter(chapter);
                saved.add(ChapterImageDto.from(imageRepository.save(image)));
            }
            return new ImageUploadDto(saved, skipped);
        });
    }

    private record StoredFile(String filename, ImageType type) {
    }

    /** Writes the file if it is a supported image; otherwise adds it to {@code skipped}. */
    private Optional<StoredFile> store(Long chapterId, MultipartFile file, List<SkippedFile> skipped) {
        String name = file.getOriginalFilename();
        String filename = null;
        try (InputStream in = new BufferedInputStream(file.getInputStream())) {
            in.mark(ImageType.HEADER_LENGTH);
            Optional<ImageType> type = ImageType.detect(in.readNBytes(ImageType.HEADER_LENGTH));
            in.reset();
            if (type.isEmpty()) {
                skipped.add(new SkippedFile(name, SkippedFile.NOT_AN_IMAGE));
                return Optional.empty();
            }
            filename = UUID.randomUUID() + type.get().extension();
            if (!storage.store(filename, in)) throw new IOException("invalid file name " + filename);
            storage.deleteIfRolledBack(filename);
            return Optional.of(new StoredFile(filename, type.get()));
        } catch (IOException e) {
            log.warn("Could not save uploaded image \"{}\" for chapter {}", name, chapterId, e);
            if (filename != null) storage.deleteNow(filename);
            skipped.add(new SkippedFile(name, SkippedFile.NOT_SAVED));
            return Optional.empty();
        }
    }

    /**
     * The type is detected from the file itself, not taken from the row: rows stored before
     * SEC-02 or imported from an archive may claim anything.
     * @return empty if the image is not in this chapter or its file is missing
     */
    @Transactional(readOnly = true)
    public Optional<StoredImage> open(Long chapterId, Long imageId) {
        return imageRepository.findByIdAndChapterId(imageId, chapterId)
                .flatMap(image -> storage.existing(image.getFilename())
                        .map(path -> new StoredImage(path, detect(path), image.getOriginalName())));
    }

    private static Optional<ImageType> detect(Path path) {
        try {
            return ImageType.detect(path);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** The file itself is removed after commit by ChapterImageFileCleanup. @return false if not in this chapter */
    @Transactional
    public boolean delete(Long chapterId, Long imageId) {
        return imageRepository.findByIdAndChapterId(imageId, chapterId).map(image -> {
            imageRepository.delete(image);
            return true;
        }).orElse(false);
    }
}
