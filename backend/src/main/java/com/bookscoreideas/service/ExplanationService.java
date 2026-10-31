package com.bookscoreideas.service;

import com.bookscoreideas.dto.ExplanationDto;
import com.bookscoreideas.entity.ChapterExplanation;
import com.bookscoreideas.repository.BookRepository;
import com.bookscoreideas.repository.ChapterExplanationRepository;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.ExplanationMarkRepository;
import com.bookscoreideas.web.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class ExplanationService {

    private final ChapterExplanationRepository explanationRepository;
    private final ChapterRepository chapterRepository;
    private final ExplanationMarkRepository markRepository;
    private final BookRepository bookRepository;

    public ExplanationService(ChapterExplanationRepository explanationRepository,
                              ChapterRepository chapterRepository,
                              ExplanationMarkRepository markRepository,
                              BookRepository bookRepository) {
        this.explanationRepository = explanationRepository;
        this.chapterRepository = chapterRepository;
        this.markRepository = markRepository;
        this.bookRepository = bookRepository;
    }

    @Transactional(readOnly = true)
    public Optional<ExplanationDto> get(Long chapterId) {
        NotFoundException.requireExists(chapterRepository.existsById(chapterId), "Chapter", chapterId);
        return explanationRepository.findByChapterId(chapterId).map(ExplanationDto::from);
    }

    /** Ids of a book's chapters that have an explanation (for badges, without the bodies). */
    @Transactional(readOnly = true)
    public List<Long> chapterIdsWithExplanation(Long bookId) {
        NotFoundException.requireExists(bookRepository.existsById(bookId), "Book", bookId);
        return explanationRepository.findChapterIdsByBookId(bookId);
    }

    /** One explanation per chapter: creates or replaces it. @return empty if the chapter does not exist */
    @Transactional
    public Optional<ExplanationDto> save(Long chapterId, String content) {
        return chapterRepository.findById(chapterId).map(chapter -> {
            ChapterExplanation explanation = explanationRepository.findByChapterId(chapterId)
                    .orElseGet(() -> {
                        ChapterExplanation created = new ChapterExplanation();
                        created.setChapter(chapter);
                        return created;
                    });
            explanation.setContent(content);
            // Flush so @PreUpdate stamps updatedAt before it is returned.
            return ExplanationDto.from(explanationRepository.saveAndFlush(explanation));
        });
    }

    /** Saved passages point into the explanation text, so they go with it. @return false if none */
    @Transactional
    public boolean delete(Long chapterId) {
        return explanationRepository.findByChapterId(chapterId).map(explanation -> {
            markRepository.deleteByChapterId(chapterId);
            explanationRepository.delete(explanation);
            return true;
        }).orElse(false);
    }
}
