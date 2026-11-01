package com.bookscoreideas.service;

import com.bookscoreideas.dto.ChapterImageDto;
import com.bookscoreideas.entity.ChapterImage;
import com.bookscoreideas.repository.ChapterImageRepository;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.web.NotFoundException;
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
     * Stores every file that is a supported image (by its bytes, {@link ImageType}); other
     * files are skipped.
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

                try (InputStream in = new BufferedInputStream(file.getInputStream())) {
                    in.mark(ImageType.HEADER_LENGTH);
                    Optional<ImageType> type = ImageType.detect(in.readNBytes(ImageType.HEADER_LENGTH));
                    in.reset();
                    if (type.isEmpty()) continue;

                    String filename = UUID.randomUUID() + type.get().extension();
                    if (!storage.store(filename, in)) continue;

                    ChapterImage image = new ChapterImage();
                    image.setFilename(filename);
                    image.setOriginalName(file.getOriginalFilename());
                    image.setContentType(type.get().contentType());
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
