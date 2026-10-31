package com.bookscoreideas.service;

import com.bookscoreideas.dto.IdeaSearchResult;
import com.bookscoreideas.dto.KeyIdeaDto;
import com.bookscoreideas.dto.KeyIdeaRequest;
import com.bookscoreideas.entity.KeyIdea;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.KeyIdeaRepository;
import com.bookscoreideas.web.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class KeyIdeaService {

    private final KeyIdeaRepository keyIdeaRepository;
    private final ChapterRepository chapterRepository;

    public KeyIdeaService(KeyIdeaRepository keyIdeaRepository, ChapterRepository chapterRepository) {
        this.keyIdeaRepository = keyIdeaRepository;
        this.chapterRepository = chapterRepository;
    }

    @Transactional(readOnly = true)
    public List<KeyIdeaDto> list(Long chapterId) {
        NotFoundException.requireExists(chapterRepository.existsById(chapterId), "Chapter", chapterId);
        return keyIdeaRepository.findByChapterIdOrderByOrderIndexAsc(chapterId).stream().map(KeyIdeaDto::from).toList();
    }

    /** Highlighted ideas across the library (the Idea Bank). */
    @Transactional(readOnly = true)
    public List<IdeaSearchResult> search(String q, Long bookId, String tag) {
        return keyIdeaRepository.searchIdeas(q, bookId, tag);
    }

    /** @return empty if the chapter does not exist */
    @Transactional
    public Optional<KeyIdeaDto> create(Long chapterId, KeyIdeaRequest request) {
        return chapterRepository.findById(chapterId).map(chapter -> {
            KeyIdea idea = new KeyIdea();
            apply(idea, request);
            idea.setChapter(chapter);
            return KeyIdeaDto.from(keyIdeaRepository.save(idea));
        });
    }

    /** @return empty if the idea does not exist in this chapter */
    @Transactional
    public Optional<KeyIdeaDto> update(Long chapterId, Long ideaId, KeyIdeaRequest request) {
        return keyIdeaRepository.findByIdAndChapterId(ideaId, chapterId).map(existing -> {
            apply(existing, request);
            return KeyIdeaDto.from(keyIdeaRepository.save(existing));
        });
    }

    /** @return false if the idea does not exist in this chapter */
    @Transactional
    public boolean delete(Long chapterId, Long ideaId) {
        return keyIdeaRepository.findByIdAndChapterId(ideaId, chapterId).map(idea -> {
            keyIdeaRepository.delete(idea);
            return true;
        }).orElse(false);
    }

    private static void apply(KeyIdea idea, KeyIdeaRequest request) {
        idea.setContent(request.content());
        idea.setExample(request.example());
        idea.setTags(request.tags());
        idea.setHighlighted(request.highlighted());
        idea.setOrderIndex(request.orderIndex());
    }
}
