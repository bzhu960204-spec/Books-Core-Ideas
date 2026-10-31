package com.bookscoreideas.service;

import com.bookscoreideas.dto.ChapterDto;
import com.bookscoreideas.dto.ChapterRequest;
import com.bookscoreideas.dto.KeyIdeaDto;
import com.bookscoreideas.entity.Chapter;
import com.bookscoreideas.entity.KeyIdea;
import com.bookscoreideas.entity.Part;
import com.bookscoreideas.repository.BookRepository;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.KeyIdeaRepository;
import com.bookscoreideas.repository.PartRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class ChapterService {

    private final ChapterRepository chapterRepository;
    private final BookRepository bookRepository;
    private final PartRepository partRepository;
    private final KeyIdeaRepository keyIdeaRepository;

    public ChapterService(ChapterRepository chapterRepository, BookRepository bookRepository,
                          PartRepository partRepository, KeyIdeaRepository keyIdeaRepository) {
        this.chapterRepository = chapterRepository;
        this.bookRepository = bookRepository;
        this.partRepository = partRepository;
        this.keyIdeaRepository = keyIdeaRepository;
    }

    /** A book's chapters with their ideas, in two queries however many chapters there are. */
    @Transactional(readOnly = true)
    public List<ChapterDto> list(Long bookId) {
        List<ChapterRepository.ChapterRow> chapters = chapterRepository.findRowsByBookId(bookId);
        if (chapters.isEmpty()) return List.of();
        Map<Long, List<KeyIdeaDto>> ideas = new HashMap<>();
        for (KeyIdea idea : keyIdeaRepository.findByChapterIds(
                chapters.stream().map(ChapterRepository.ChapterRow::getId).toList())) {
            ideas.computeIfAbsent(idea.getChapter().getId(), id -> new ArrayList<>()).add(KeyIdeaDto.from(idea));
        }
        return chapters.stream()
                .map(c -> new ChapterDto(c.getId(), c.getTitle(), c.getOrderIndex(), c.getSummary(),
                        c.getPartId(), ideas.getOrDefault(c.getId(), List.of())))
                .toList();
    }

    /** @return empty if the book does not exist */
    @Transactional
    public Optional<ChapterDto> create(Long bookId, ChapterRequest request) {
        return bookRepository.findById(bookId).map(book -> {
            Chapter chapter = new Chapter();
            chapter.setTitle(request.title());
            chapter.setOrderIndex(request.orderIndex());
            chapter.setSummary(request.summary());
            applyPart(chapter, bookId, request.partId());
            chapter.setBook(book);
            return toDto(chapterRepository.save(chapter));
        });
    }

    /** @return empty if the chapter does not exist in this book */
    @Transactional
    public Optional<ChapterDto> update(Long bookId, Long chapterId, ChapterRequest request) {
        return chapterRepository.findByIdAndBookId(chapterId, bookId).map(existing -> {
            applyPart(existing, bookId, request.partId());
            existing.setTitle(request.title());
            existing.setOrderIndex(request.orderIndex());
            existing.setSummary(request.summary());
            return toDto(chapterRepository.save(existing));
        });
    }

    /** @return false if the chapter does not exist in this book */
    @Transactional
    public boolean delete(Long bookId, Long chapterId) {
        return chapterRepository.findByIdAndBookId(chapterId, bookId).map(chapter -> {
            chapterRepository.delete(chapter);
            return true;
        }).orElse(false);
    }

    // Resolve the optional partId from the request into the Part relationship.
    // A null partId clears the grouping (plain chapter); a part from another
    // book is rejected.
    private void applyPart(Chapter chapter, Long bookId, Long partId) {
        if (partId == null) {
            chapter.setPart(null);
            return;
        }
        Part part = partRepository.findByIdAndBookId(partId, bookId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Part " + partId + " does not belong to book " + bookId));
        chapter.setPart(part);
    }

    private static ChapterDto toDto(Chapter chapter) {
        return ChapterDto.from(chapter, chapter.getKeyIdeas().stream().map(KeyIdeaDto::from).toList());
    }
}
