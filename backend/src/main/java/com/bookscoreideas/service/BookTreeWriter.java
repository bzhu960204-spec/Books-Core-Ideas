package com.bookscoreideas.service;

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

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
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

    public BookTreeWriter(PartRepository partRepository, ChapterRepository chapterRepository,
                          KeyIdeaRepository keyIdeaRepository, ExcerptRepository excerptRepository,
                          ChapterExplanationRepository explanationRepository, ChapterImageRepository imageRepository,
                          ReadingBookmarkRepository bookmarkRepository, ExplanationMarkRepository markRepository) {
        this.partRepository = partRepository;
        this.chapterRepository = chapterRepository;
        this.keyIdeaRepository = keyIdeaRepository;
        this.excerptRepository = excerptRepository;
        this.explanationRepository = explanationRepository;
        this.imageRepository = imageRepository;
        this.bookmarkRepository = bookmarkRepository;
        this.markRepository = markRepository;
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

    /**
     * A chapter (in {@code part}, or ungrouped when null) with its ideas, excerpts,
     * explanation, bookmarks, marks and images. Image rows are saved here; their bytes
     * are added to {@code imageWrites} so the caller writes files only after commit.
     */
    public Chapter writeChapter(Book book, Part part, ChapterArchiveDto dto,
                                Map<String, byte[]> imageBytesByFilename,
                                List<MigrationImporter.PendingImageWrite> imageWrites) {
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
                byte[] bytes = imgDto.filename() != null ? imageBytesByFilename.get(imgDto.filename()) : null;
                if (bytes == null) continue;
                String newFilename = UUID.randomUUID() + extensionOf(imgDto.filename(), imgDto.originalName());
                ChapterImage image = new ChapterImage();
                image.setFilename(newFilename);
                image.setOriginalName(imgDto.originalName());
                image.setContentType(imgDto.contentType());
                image.setOrderIndex(imgDto.orderIndex() != null ? imgDto.orderIndex() : idx);
                image.setChapter(chapter);
                imageRepository.save(image);
                imageWrites.add(new MigrationImporter.PendingImageWrite(newFilename, bytes));
                idx++;
            }
        }
        return chapter;
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

    private static String extensionOf(String filename, String originalName) {
        for (String candidate : new String[]{filename, originalName}) {
            if (candidate != null) {
                int dot = candidate.lastIndexOf('.');
                if (dot >= 0 && dot < candidate.length() - 1) {
                    return candidate.substring(dot).toLowerCase();
                }
            }
        }
        return "";
    }
}
