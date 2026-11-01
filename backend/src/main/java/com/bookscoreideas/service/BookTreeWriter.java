package com.bookscoreideas.service;

import com.bookscoreideas.dto.SkippedFile;
import com.bookscoreideas.dto.migration.BookmarkArchiveDto;
import com.bookscoreideas.dto.migration.ChapterArchiveDto;
import com.bookscoreideas.dto.migration.ExcerptArchiveDto;
import com.bookscoreideas.dto.migration.ImageArchiveDto;
import com.bookscoreideas.dto.migration.KeyIdeaArchiveDto;
import com.bookscoreideas.dto.migration.MarkArchiveDto;
import com.bookscoreideas.dto.migration.PartArchiveDto;
import com.bookscoreideas.entity.Book;
import com.bookscoreideas.entity.Chapter;
import com.bookscoreideas.entity.ChapterExplanation;
import com.bookscoreideas.entity.ChapterImage;
import com.bookscoreideas.entity.Excerpt;
import com.bookscoreideas.entity.ExplanationMark;
import com.bookscoreideas.entity.KeyIdea;
import com.bookscoreideas.entity.Part;
import com.bookscoreideas.entity.ReadingBookmark;
import com.bookscoreideas.repository.ChapterExplanationRepository;
import com.bookscoreideas.repository.ChapterImageRepository;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.ExcerptRepository;
import com.bookscoreideas.repository.ExplanationMarkRepository;
import com.bookscoreideas.repository.KeyIdeaRepository;
import com.bookscoreideas.repository.PartRepository;
import com.bookscoreideas.repository.ReadingBookmarkRepository;
import org.springframework.stereotype.Component;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Writes parts, chapters and everything a chapter owns under a book, from archive
 * snapshots. The one place that creates these rows for imports: the ZIP migration
 * ({@link MigrationImporter}) and the JSON import ({@link JsonImportService}) both use
 * it (BE-06). Callers provide the transaction.
 */
@Component
public class BookTreeWriter {

    private final PartRepository partRepository;
    private final ChapterRepository chapterRepository;
    private final KeyIdeaRepository keyIdeaRepository;
    private final ExcerptRepository excerptRepository;
    private final ChapterExplanationRepository explanationRepository;
    private final ChapterImageRepository imageRepository;
    private final ReadingBookmarkRepository bookmarkRepository;
    private final ExplanationMarkRepository markRepository;
    private final ChapterImageStorage storage;

    public BookTreeWriter(PartRepository partRepository, ChapterRepository chapterRepository,
                          KeyIdeaRepository keyIdeaRepository, ExcerptRepository excerptRepository,
                          ChapterExplanationRepository explanationRepository, ChapterImageRepository imageRepository,
                          ReadingBookmarkRepository bookmarkRepository, ExplanationMarkRepository markRepository,
                          ChapterImageStorage storage) {
        this.partRepository = partRepository;
        this.chapterRepository = chapterRepository;
        this.keyIdeaRepository = keyIdeaRepository;
        this.excerptRepository = excerptRepository;
        this.explanationRepository = explanationRepository;
        this.imageRepository = imageRepository;
        this.bookmarkRepository = bookmarkRepository;
        this.markRepository = markRepository;
        this.storage = storage;
    }

    /** The part itself; its chapters are written with {@link #writeChapter}. */
    public Part writePart(Book book, PartArchiveDto dto) {
        Part part = new Part();
        part.setTitle(dto.title());
        part.setOrderIndex(dto.orderIndex());
        part.setSummary(dto.summary());
        part.setBook(book);
        return partRepository.save(part);
    }

    /** The image files of an archive, opened by the name the archive's book.json gives them. */
    @FunctionalInterface
    public interface ImageSource {
        ImageSource NONE = filename -> Optional.empty();

        /** @return empty if the archive has no such file */
        Optional<InputStream> open(String filename) throws IOException;
    }

    /**
     * A chapter (in {@code part}, or ungrouped when null) with its ideas, excerpts,
     * explanation, bookmarks, marks and images.
     * The archive may come from someone else (SEC-04): an image is imported only if its
     * bytes are a supported {@link ImageType}, which also decides the stored name and type;
     * every other image goes to {@code skippedImages}.
     * Image files are streamed to disk here, inside the caller's transaction, and deleted
     * again if it rolls back (BE-07). A file that cannot be read or written fails the
     * chapter, and so the caller's transaction, with an {@link UncheckedIOException}.
     * @param storedImages receives the stored name of every image file written
     */
    public Chapter writeChapter(Book book, Part part, ChapterArchiveDto dto, ImageSource images,
                                List<String> storedImages, List<SkippedFile> skippedImages) {
        Chapter chapter = new Chapter();
        chapter.setTitle(dto.title());
        chapter.setOrderIndex(dto.orderIndex());
        chapter.setSummary(dto.summary());
        chapter.setBook(book);
        if (part != null) chapter.setPart(part);
        chapter = chapterRepository.save(chapter);

        if (dto.keyIdeas() != null) {
            for (KeyIdeaArchiveDto idea : dto.keyIdeas()) writeIdea(chapter, idea);
        }
        if (dto.excerpts() != null) {
            for (ExcerptArchiveDto excerpt : dto.excerpts()) writeExcerpt(chapter, excerpt);
        }

        if (dto.explanation() != null && dto.explanation().content() != null
                && !dto.explanation().content().isBlank()) {
            ChapterExplanation explanation = new ChapterExplanation();
            explanation.setChapter(chapter);
            explanation.setContent(dto.explanation().content());
            explanation.setUpdatedAt(parseDate(dto.explanation().updatedAt()));
            explanationRepository.save(explanation);
        }

        if (dto.bookmarks() != null) {
            for (BookmarkArchiveDto bmDto : dto.bookmarks()) {
                ReadingBookmark bookmark = new ReadingBookmark();
                bookmark.setBook(book);
                bookmark.setChapter(chapter);
                bookmark.setScrollRatio(bmDto.scrollRatio());
                bookmark.setNote(bmDto.note());
                bookmark.setCreatedAt(parseDateTime(bmDto.createdAt()));
                bookmarkRepository.save(bookmark);
            }
        }

        if (dto.marks() != null) {
            for (MarkArchiveDto markDto : dto.marks()) {
                ExplanationMark mark = new ExplanationMark();
                mark.setBook(book);
                mark.setChapter(chapter);
                mark.setQuote(markDto.quote());
                mark.setPrefix(markDto.prefix());
                mark.setSuffix(markDto.suffix());
                mark.setStartOffset(markDto.startOffset());
                mark.setEndOffset(markDto.endOffset());
                mark.setNote(markDto.note());
                mark.setCreatedAt(parseDateTime(markDto.createdAt()));
                mark.setUpdatedAt(parseDateTime(markDto.updatedAt()));
                markRepository.save(mark);
            }
        }

        if (dto.images() != null) {
            int idx = 1;
            for (ImageArchiveDto imgDto : dto.images()) {
                String name = imgDto.originalName() != null ? imgDto.originalName() : imgDto.filename();
                Optional<StoredFile> stored;
                try {
                    stored = storeImage(imgDto.filename(), name, images, skippedImages);
                } catch (IOException e) {
                    throw new UncheckedIOException("Could not import image " + name + ": " + e.getMessage(), e);
                }
                if (stored.isEmpty()) continue;
                ChapterImage image = new ChapterImage();
                image.setFilename(stored.get().filename());
                image.setOriginalName(ChapterImage.fitOriginalName(imgDto.originalName()));
                image.setContentType(stored.get().type().contentType());
                image.setOrderIndex(imgDto.orderIndex() != null ? imgDto.orderIndex() : idx);
                image.setChapter(chapter);
                imageRepository.save(image);
                storedImages.add(stored.get().filename());
                idx++;
            }
        }
        return chapter;
    }

    private record StoredFile(String filename, ImageType type) {
    }

    /** Streams the archive's file to disk if it is a supported image; otherwise adds it to {@code skipped}. */
    private Optional<StoredFile> storeImage(String archiveName, String name, ImageSource images,
                                            List<SkippedFile> skipped) throws IOException {
        Optional<InputStream> source = archiveName != null ? images.open(archiveName) : Optional.empty();
        if (source.isEmpty()) {
            skipped.add(new SkippedFile(name, SkippedFile.MISSING));
            return Optional.empty();
        }
        try (InputStream in = new BufferedInputStream(source.get())) {
            in.mark(ImageType.HEADER_LENGTH);
            byte[] header = in.readNBytes(ImageType.HEADER_LENGTH);
            in.reset();
            Optional<ImageType> type = ImageType.detect(header);
            if (type.isEmpty()) {
                skipped.add(new SkippedFile(name, header.length == 0 ? SkippedFile.EMPTY : SkippedFile.NOT_AN_IMAGE));
                return Optional.empty();
            }
            String filename = UUID.randomUUID() + type.get().extension();
            // Registered before writing, so a half-written file goes too when the failure rolls back.
            storage.deleteIfRolledBack(filename);
            if (!storage.store(filename, in)) throw new IOException("invalid file name " + filename);
            return Optional.of(new StoredFile(filename, type.get()));
        }
    }

    public void writeIdea(Chapter chapter, KeyIdeaArchiveDto dto) {
        KeyIdea idea = new KeyIdea();
        idea.setContent(dto.content());
        idea.setExample(dto.example());
        idea.setTags(dto.tags());
        idea.setHighlighted(dto.highlighted());
        idea.setOrderIndex(dto.orderIndex());
        idea.setChapter(chapter);
        keyIdeaRepository.save(idea);
    }

    public void writeExcerpt(Chapter chapter, ExcerptArchiveDto dto) {
        Excerpt excerpt = new Excerpt();
        excerpt.setContent(dto.content());
        excerpt.setNote(dto.note());
        excerpt.setSource(dto.source());
        excerpt.setHighlighted(dto.highlighted());
        excerpt.setOrderIndex(dto.orderIndex());
        excerpt.setChapter(chapter);
        excerptRepository.save(excerpt);
    }

    static LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDate.parse(value);
        } catch (Exception e) {
            return null;
        }
    }

    // Unparseable or missing timestamps fall back to "now" (set by the entity on insert).
    static LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDateTime.parse(value);
        } catch (Exception e) {
            return null;
        }
    }
}
