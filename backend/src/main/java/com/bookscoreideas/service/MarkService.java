package com.bookscoreideas.service;

import com.bookscoreideas.dto.MarkDto;
import com.bookscoreideas.entity.ExplanationMark;
import com.bookscoreideas.repository.BookRepository;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.ExplanationMarkRepository;
import com.bookscoreideas.web.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

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
    private final BookRepository bookRepository;

    public MarkService(ExplanationMarkRepository markRepository, ChapterRepository chapterRepository,
                       BookRepository bookRepository) {
        this.markRepository = markRepository;
        this.chapterRepository = chapterRepository;
        this.bookRepository = bookRepository;
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
        NotFoundException.requireExists(bookRepository.existsById(bookId), "Book", bookId);
        return markRepository.findRowsByBookId(bookId).stream().map(MarkService::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<MarkDto> listByChapter(Long chapterId) {
        NotFoundException.requireExists(chapterRepository.existsById(chapterId), "Chapter", chapterId);
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

    /**
     * How one passage of a chapter stands after its explanation changed. Orphaned = its text
     * is gone: only the flag is set, quote, note and the old anchor are kept. Otherwise it
     * is found (again): the flag is cleared, and every non-null field replaces the stored one
     * (re-linking sends a new quote too).
     */
    public record AnchorUpdate(Long id, String quote, String prefix, String suffix, Integer startOffset,
                               Integer endOffset, boolean orphaned) {
    }

    /**
     * Applies the updates to the chapter's passages; ids that are not the chapter's are ignored.
     * @return the chapter's passages after the update, or empty if the chapter does not exist
     */
    @Transactional
    public Optional<List<MarkDto>> updateAnchors(Long chapterId, List<AnchorUpdate> updates) {
        if (!chapterRepository.existsById(chapterId)) return Optional.empty();
        Map<Long, ExplanationMark> marks = markRepository.findByChapterIdOrderByIdAsc(chapterId).stream()
                .collect(Collectors.toMap(ExplanationMark::getId, Function.identity()));
        for (AnchorUpdate update : updates) {
            ExplanationMark mark = marks.get(update.id());
            if (mark == null) continue;
            mark.setOrphaned(update.orphaned());
            if (update.orphaned()) continue;
            if (update.quote() != null && !update.quote().isBlank()) mark.setQuote(update.quote());
            if (update.prefix() != null) mark.setPrefix(truncate(update.prefix(), MAX_CONTEXT));
            if (update.suffix() != null) mark.setSuffix(truncate(update.suffix(), MAX_CONTEXT));
            if (update.startOffset() != null) mark.setStartOffset(update.startOffset());
            if (update.endOffset() != null) mark.setEndOffset(update.endOffset());
        }
        return Optional.of(listByChapter(chapterId));
    }

    private static MarkDto toDto(ExplanationMarkRepository.MarkRow r) {
        return MarkDto.of(r.getId(), r.getBookId(), r.getBookTitle(), r.getChapterId(), r.getChapterTitle(),
                r.getChapterOrderIndex(), r.getQuote(), r.getPrefix(), r.getSuffix(), r.getStartOffset(),
                r.getEndOffset(), r.getNote(), r.getOrphaned(), r.getCreatedAt(), r.getUpdatedAt());
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
