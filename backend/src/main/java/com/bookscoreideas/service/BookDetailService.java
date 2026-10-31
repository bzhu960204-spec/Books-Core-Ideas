package com.bookscoreideas.service;

import com.bookscoreideas.dto.BookDetailDto;
import com.bookscoreideas.dto.BookDto;
import com.bookscoreideas.dto.ChapterDetailDto;
import com.bookscoreideas.dto.ChapterDto;
import com.bookscoreideas.dto.ExcerptDto;
import com.bookscoreideas.entity.Excerpt;
import com.bookscoreideas.repository.BookRepository;
import com.bookscoreideas.repository.ChapterExplanationRepository;
import com.bookscoreideas.repository.ChapterImageRepository;
import com.bookscoreideas.repository.ExcerptRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * The book page in one response (FE-03). The page used to request every chapter's
 * excerpts and images separately; this reads the same data in a fixed number of
 * queries, however many chapters the book has.
 */
@Service
public class BookDetailService {

    private final BookRepository bookRepository;
    private final ChapterService chapterService;
    private final PartService partService;
    private final BookmarkService bookmarkService;
    private final MarkService markService;
    private final ExcerptRepository excerptRepository;
    private final ChapterImageRepository imageRepository;
    private final ChapterExplanationRepository explanationRepository;

    public BookDetailService(BookRepository bookRepository, ChapterService chapterService, PartService partService,
                             BookmarkService bookmarkService, MarkService markService,
                             ExcerptRepository excerptRepository, ChapterImageRepository imageRepository,
                             ChapterExplanationRepository explanationRepository) {
        this.bookRepository = bookRepository;
        this.chapterService = chapterService;
        this.partService = partService;
        this.bookmarkService = bookmarkService;
        this.markService = markService;
        this.excerptRepository = excerptRepository;
        this.imageRepository = imageRepository;
        this.explanationRepository = explanationRepository;
    }

    /** @return empty if the book does not exist */
    @Transactional(readOnly = true)
    public Optional<BookDetailDto> get(Long bookId) {
        return bookRepository.findById(bookId).map(book -> {
            List<ChapterDto> chapters = chapterService.list(bookId);
            List<Long> chapterIds = chapters.stream().map(ChapterDto::id).toList();

            Map<Long, List<ExcerptDto>> excerpts = new HashMap<>();
            if (!chapterIds.isEmpty()) {
                for (Excerpt excerpt : excerptRepository.findByChapterIds(chapterIds)) {
                    excerpts.computeIfAbsent(excerpt.getChapter().getId(), id -> new ArrayList<>())
                            .add(ExcerptDto.from(excerpt));
                }
            }
            Map<Long, Long> imageCounts = new HashMap<>();
            for (Object[] row : imageRepository.countByBookId(bookId)) {
                imageCounts.put((Long) row[0], (Long) row[1]);
            }
            Set<Long> explained = new HashSet<>(explanationRepository.findChapterIdsByBookId(bookId));

            List<ChapterDetailDto> chapterDetails = chapters.stream()
                    .map(c -> new ChapterDetailDto(c.id(), c.title(), c.orderIndex(), c.summary(), c.partId(),
                            c.keyIdeas(), excerpts.getOrDefault(c.id(), List.of()),
                            imageCounts.getOrDefault(c.id(), 0L), explained.contains(c.id())))
                    .toList();

            return new BookDetailDto(
                    BookDto.from(book, chapters.size()),
                    partService.list(bookId),
                    chapterDetails,
                    bookmarkService.list(bookId),
                    markService.listByBook(bookId));
        });
    }
}
