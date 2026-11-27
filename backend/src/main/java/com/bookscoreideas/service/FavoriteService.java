package com.bookscoreideas.service;

import com.bookscoreideas.dto.FavoriteDto;
import com.bookscoreideas.entity.Book;
import com.bookscoreideas.entity.Chapter;
import com.bookscoreideas.entity.ChapterFavorite;
import com.bookscoreideas.repository.ChapterExplanationRepository;
import com.bookscoreideas.repository.ChapterFavoriteRepository;
import com.bookscoreideas.repository.ChapterRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Favorite chapters: chapters whose explanation is worth re-reading, starred so they
 * can be found again across all books. One favorite per chapter.
 */
@Service
public class FavoriteService {

    private final ChapterFavoriteRepository favoriteRepository;
    private final ChapterRepository chapterRepository;
    private final ChapterExplanationRepository explanationRepository;

    public FavoriteService(ChapterFavoriteRepository favoriteRepository, ChapterRepository chapterRepository,
                           ChapterExplanationRepository explanationRepository) {
        this.favoriteRepository = favoriteRepository;
        this.chapterRepository = chapterRepository;
        this.explanationRepository = explanationRepository;
    }

    /**
     * Stars the chapter, or updates its favorite. A null note keeps the current note;
     * otherwise the note is replaced (blank clears it).
     * @return empty if the chapter does not exist
     */
    @Transactional
    public Optional<FavoriteDto> favorite(Long chapterId, String note) {
        return chapterRepository.findById(chapterId).map(chapter -> {
            ChapterFavorite favorite = favoriteRepository.findByChapterId(chapterId).orElseGet(() -> {
                ChapterFavorite created = new ChapterFavorite();
                created.setChapter(chapter);
                created.setBook(chapter.getBook());
                return created;
            });
            if (note != null) favorite.setNote(note.isBlank() ? null : note.trim());
            return toDto(favoriteRepository.save(favorite));
        });
    }

    /** Idempotent: unstarring a chapter that is not a favorite is fine. @return false if the chapter does not exist */
    @Transactional
    public boolean unfavorite(Long chapterId) {
        if (!chapterRepository.existsById(chapterId)) return false;
        favoriteRepository.findByChapterId(chapterId).ifPresent(favoriteRepository::delete);
        return true;
    }

    /** Newest first; every book's favorites when {@code bookId} is null. */
    @Transactional(readOnly = true)
    public List<FavoriteDto> list(Long bookId, String q) {
        String query = q != null && !q.isBlank() ? q.trim() : null;
        return favoriteRepository.findRows(bookId, query).stream()
                .map(r -> FavoriteDto.of(r.getId(), r.getChapterId(), r.getChapterTitle(), r.getChapterOrderIndex(),
                        r.getChapterSummary(), r.getHasExplanation(), r.getBookId(), r.getBookTitle(),
                        r.getBookAuthor(), r.getBookCoverUrl(), r.getNote(), r.getCreatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Long> chapterIds(Long bookId) {
        return favoriteRepository.findChapterIdsByBookId(bookId);
    }

    private FavoriteDto toDto(ChapterFavorite favorite) {
        Chapter chapter = favorite.getChapter();
        Book book = favorite.getBook();
        return FavoriteDto.of(favorite.getId(), chapter.getId(), chapter.getTitle(), chapter.getOrderIndex(),
                chapter.getSummary(), explanationRepository.existsByChapterId(chapter.getId()),
                book.getId(), book.getTitle(), book.getAuthor(), book.getCoverUrl(),
                favorite.getNote(), favorite.getCreatedAt());
    }
}
