package com.bookscoreideas.service;

import com.bookscoreideas.dto.ExcerptDto;
import com.bookscoreideas.dto.ExcerptRequest;
import com.bookscoreideas.dto.ExcerptSearchResult;
import com.bookscoreideas.entity.Excerpt;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.ExcerptRepository;
import com.bookscoreideas.web.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class ExcerptService {

    private final ExcerptRepository excerptRepository;
    private final ChapterRepository chapterRepository;

    public ExcerptService(ExcerptRepository excerptRepository, ChapterRepository chapterRepository) {
        this.excerptRepository = excerptRepository;
        this.chapterRepository = chapterRepository;
    }

    @Transactional(readOnly = true)
    public List<ExcerptDto> list(Long chapterId) {
        NotFoundException.requireExists(chapterRepository.existsById(chapterId), "Chapter", chapterId);
        return excerptRepository.findByChapterIdOrderByOrderIndexAsc(chapterId).stream().map(ExcerptDto::from).toList();
    }

    /** Highlighted excerpts across the library (the Excerpt Bank). */
    @Transactional(readOnly = true)
    public List<ExcerptSearchResult> search(String q, Long bookId) {
        return excerptRepository.searchExcerpts(q, bookId);
    }

    /** @return empty if the chapter does not exist */
    @Transactional
    public Optional<ExcerptDto> create(Long chapterId, ExcerptRequest request) {
        return chapterRepository.findById(chapterId).map(chapter -> {
            Excerpt excerpt = new Excerpt();
            apply(excerpt, request);
            excerpt.setChapter(chapter);
            return ExcerptDto.from(excerptRepository.save(excerpt));
        });
    }

    /** @return empty if the excerpt does not exist in this chapter */
    @Transactional
    public Optional<ExcerptDto> update(Long chapterId, Long excerptId, ExcerptRequest request) {
        return excerptRepository.findByIdAndChapterId(excerptId, chapterId).map(existing -> {
            apply(existing, request);
            return ExcerptDto.from(excerptRepository.save(existing));
        });
    }

    /** @return false if the excerpt does not exist in this chapter */
    @Transactional
    public boolean delete(Long chapterId, Long excerptId) {
        return excerptRepository.findByIdAndChapterId(excerptId, chapterId).map(excerpt -> {
            excerptRepository.delete(excerpt);
            return true;
        }).orElse(false);
    }

    private static void apply(Excerpt excerpt, ExcerptRequest request) {
        excerpt.setContent(request.content());
        excerpt.setNote(request.note());
        excerpt.setSource(request.source());
        excerpt.setOrderIndex(request.orderIndex());
        excerpt.setHighlighted(request.highlighted());
    }
}
