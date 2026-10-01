package com.bookscoreideas.service;

import com.bookscoreideas.dto.migration.BookArchiveDto;
import com.bookscoreideas.dto.migration.ChapterArchiveDto;
import com.bookscoreideas.dto.migration.ExcerptArchiveDto;
import com.bookscoreideas.dto.migration.ImageArchiveDto;
import com.bookscoreideas.dto.migration.KeyIdeaArchiveDto;
import com.bookscoreideas.dto.migration.PartArchiveDto;
import com.bookscoreideas.entity.Book;
import com.bookscoreideas.entity.Chapter;
import com.bookscoreideas.entity.ChapterExplanation;
import com.bookscoreideas.entity.ChapterImage;
import com.bookscoreideas.entity.Excerpt;
import com.bookscoreideas.entity.KeyIdea;
import com.bookscoreideas.entity.Part;
import com.bookscoreideas.repository.BookRepository;
import com.bookscoreideas.repository.ChapterExplanationRepository;
import com.bookscoreideas.repository.ChapterImageRepository;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.ExcerptRepository;
import com.bookscoreideas.repository.KeyIdeaRepository;
import com.bookscoreideas.repository.PartRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Persists a single imported book inside its own transaction so that a failure
 * on one book rolls back only that book, not the whole archive. Image bytes are
 * returned (not written here) so that files only hit disk after a successful
 * commit.
 */
@Component
public class MigrationImporter {

    private final BookRepository bookRepository;
    private final PartRepository partRepository;
    private final ChapterRepository chapterRepository;
    private final KeyIdeaRepository keyIdeaRepository;
    private final ExcerptRepository excerptRepository;
    private final ChapterExplanationRepository explanationRepository;
    private final ChapterImageRepository imageRepository;

    public MigrationImporter(BookRepository bookRepository, PartRepository partRepository,
                             ChapterRepository chapterRepository, KeyIdeaRepository keyIdeaRepository,
                             ExcerptRepository excerptRepository,
                             ChapterExplanationRepository explanationRepository,
                             ChapterImageRepository imageRepository) {
        this.bookRepository = bookRepository;
        this.partRepository = partRepository;
        this.chapterRepository = chapterRepository;
        this.keyIdeaRepository = keyIdeaRepository;
        this.excerptRepository = excerptRepository;
        this.explanationRepository = explanationRepository;
        this.imageRepository = imageRepository;
    }

    public record PendingImageWrite(String filename, byte[] bytes) {}

    public record PersistOutcome(int chaptersImported, List<PendingImageWrite> imageWrites) {}

    @Transactional
    public PersistOutcome persistBook(BookArchiveDto dto, Map<String, byte[]> imageBytesByFilename) {
        Book book = new Book();
        book.setTitle(dto.title());
        book.setAuthor(dto.author());
        book.setIsbn(dto.isbn());
        book.setDescription(dto.description());
        book.setCoverUrl(dto.coverUrl());
        book.setRating(dto.rating());
        book.setCategory(dto.category());
        book.setReadingStatus(dto.readingStatus());
        book.setDateAdded(parseDate(dto.dateAdded()));
        book.setStartDate(parseDate(dto.startDate()));
        book.setFinishDate(parseDate(dto.finishDate()));
        book.setChapterImagesEnabled(dto.chapterImagesEnabled() != null ? dto.chapterImagesEnabled() : false);
        boolean isParts = "PARTS".equals(dto.structureType());
        book.setStructureType(isParts ? "PARTS" : "CHAPTERS");
        book = bookRepository.save(book);

        List<PendingImageWrite> writes = new ArrayList<>();
        int chapterCount = 0;

        if (isParts && dto.parts() != null) {
            for (PartArchiveDto partDto : dto.parts()) {
                Part part = new Part();
                part.setTitle(partDto.title());
                part.setOrderIndex(partDto.orderIndex());
                part.setSummary(partDto.summary());
                part.setBook(book);
                part = partRepository.save(part);
                if (partDto.chapters() != null) {
                    for (ChapterArchiveDto chDto : partDto.chapters()) {
                        persistChapter(book, part, chDto, imageBytesByFilename, writes);
                        chapterCount++;
                    }
                }
            }
        } else if (dto.chapters() != null) {
            for (ChapterArchiveDto chDto : dto.chapters()) {
                persistChapter(book, null, chDto, imageBytesByFilename, writes);
                chapterCount++;
            }
        }

        return new PersistOutcome(chapterCount, writes);
    }

    private void persistChapter(Book book, Part part, ChapterArchiveDto chDto,
                                Map<String, byte[]> imageBytesByFilename,
                                List<PendingImageWrite> writes) {
        Chapter chapter = new Chapter();
        chapter.setTitle(chDto.title());
        chapter.setOrderIndex(chDto.orderIndex());
        chapter.setSummary(chDto.summary());
        chapter.setBook(book);
        if (part != null) chapter.setPart(part);
        chapter = chapterRepository.save(chapter);

        if (chDto.keyIdeas() != null) {
            for (KeyIdeaArchiveDto ideaDto : chDto.keyIdeas()) {
                KeyIdea idea = new KeyIdea();
                idea.setContent(ideaDto.content());
                idea.setExample(ideaDto.example());
                idea.setTags(ideaDto.tags());
                idea.setHighlighted(ideaDto.highlighted());
                idea.setOrderIndex(ideaDto.orderIndex());
                idea.setChapter(chapter);
                keyIdeaRepository.save(idea);
            }
        }

        if (chDto.excerpts() != null) {
            for (ExcerptArchiveDto exDto : chDto.excerpts()) {
                Excerpt excerpt = new Excerpt();
                excerpt.setContent(exDto.content());
                excerpt.setNote(exDto.note());
                excerpt.setSource(exDto.source());
                excerpt.setHighlighted(exDto.highlighted());
                excerpt.setOrderIndex(exDto.orderIndex());
                excerpt.setChapter(chapter);
                excerptRepository.save(excerpt);
            }
        }

        if (chDto.explanation() != null && chDto.explanation().content() != null
                && !chDto.explanation().content().isBlank()) {
            ChapterExplanation explanation = new ChapterExplanation();
            explanation.setChapter(chapter);
            explanation.setContent(chDto.explanation().content());
            explanationRepository.save(explanation);
        }

        if (chDto.images() != null) {
            int idx = 1;
            for (ImageArchiveDto imgDto : chDto.images()) {
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
                writes.add(new PendingImageWrite(newFilename, bytes));
                idx++;
            }
        }
    }

    private static LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDate.parse(value);
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
