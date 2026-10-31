package com.bookscoreideas.service;

import com.bookscoreideas.dto.MarkDto;
import com.bookscoreideas.entity.ExplanationMark;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.ExplanationMarkRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Saved passages ("marks") from chapter explanations. Each mark stores the
 * selected text and locating context so the reader can jump back to it.
 */
@Service
public class MarkService {

    public static final int MAX_CONTEXT = 200;
    public static final int MAX_NOTE = 1000;

    /** Fields of a new mark; context and note are trimmed/truncated here. */
    public record NewMark(String quote, String prefix, String suffix, Integer startOffset, Integer endOffset,
                          String note) {
    }

    private final ExplanationMarkRepository markRepository;
    private final ChapterRepository chapterRepository;

    public MarkService(ExplanationMarkRepository markRepository, ChapterRepository chapterRepository) {
        this.markRepository = markRepository;
        this.chapterRepository = chapterRepository;
    }

    /** @return empty if the chapter does not exist */
    @Transactional
    public Optional<MarkDto> create(Long chapterId, NewMark request) {
        return chapterRepository.findById(chapterId).map(chapter -> {
            ExplanationMark mark = new ExplanationMark();
            mark.setChapter(chapter);
            mark.setBook(chapter.getBook());
            mark.setQuote(request.quote());
            mark.setPrefix(truncate(request.prefix(), MAX_CONTEXT));
            mark.setSuffix(truncate(request.suffix(), MAX_CONTEXT));
            mark.setStartOffset(request.startOffset());
            mark.setEndOffset(request.endOffset());
            mark.setNote(normalizeNote(request.note()));
            return MarkDto.from(markRepository.save(mark));
        });
    }

    /** Ordered by chapter, then position in the explanation. */
    @Transactional(readOnly = true)
    public List<MarkDto> listByBook(Long bookId) {
        return markRepository.findRowsByBookId(bookId).stream().map(MarkService::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<MarkDto> listByChapter(Long chapterId) {
        return markRepository.findRowsByChapterId(chapterId).stream().map(MarkService::toDto).toList();
    }

    /** @return empty if the mark does not exist */
    @Transactional
    public Optional<MarkDto> updateNote(Long id, String note) {
        return markRepository.findById(id).map(mark -> {
            mark.setNote(normalizeNote(note));
            // Flush so @PreUpdate stamps updatedAt before it is returned.
            return MarkDto.from(markRepository.saveAndFlush(mark));
        });
    }

    /** @return false if the mark does not exist */
    @Transactional
    public boolean delete(Long id) {
        if (!markRepository.existsById(id)) return false;
        markRepository.deleteById(id);
        return true;
    }

    private static MarkDto toDto(ExplanationMarkRepository.MarkRow r) {
        return MarkDto.of(r.getId(), r.getBookId(), r.getBookTitle(), r.getChapterId(), r.getChapterTitle(),
                r.getChapterOrderIndex(), r.getQuote(), r.getPrefix(), r.getSuffix(), r.getStartOffset(),
                r.getEndOffset(), r.getNote(), r.getCreatedAt(), r.getUpdatedAt());
    }

    private static String truncate(String text, int max) {
        if (text == null) return null;
        return text.length() > max ? text.substring(0, max) : text;
    }

    private static String normalizeNote(String note) {
        if (note == null || note.isBlank()) return null;
        String text = note.trim();
        return text.length() > MAX_NOTE ? text.substring(0, MAX_NOTE) : text;
    }
}
