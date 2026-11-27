package com.bookscoreideas.service;

import com.bookscoreideas.dto.migration.BookArchiveDto;
import com.bookscoreideas.dto.migration.BookmarkArchiveDto;
import com.bookscoreideas.dto.migration.ChapterArchiveDto;
import com.bookscoreideas.dto.migration.ExplanationArchiveDto;
import com.bookscoreideas.dto.migration.FavoriteArchiveDto;
import com.bookscoreideas.dto.migration.ImageArchiveDto;
import com.bookscoreideas.dto.migration.MarkArchiveDto;
import com.bookscoreideas.dto.migration.PartArchiveDto;
import com.bookscoreideas.dto.migration.ReviewArchiveDto;
import com.bookscoreideas.entity.Book;
import com.bookscoreideas.entity.BookCollection;
import com.bookscoreideas.entity.BookCollectionItem;
import com.bookscoreideas.entity.Chapter;
import com.bookscoreideas.entity.Part;
import com.bookscoreideas.entity.ReadingStatus;
import com.bookscoreideas.repository.BookCollectionItemRepository;
import com.bookscoreideas.repository.BookCollectionRepository;
import com.bookscoreideas.repository.BookReviewRepository;
import com.bookscoreideas.repository.ChapterExplanationRepository;
import com.bookscoreideas.repository.ChapterFavoriteRepository;
import com.bookscoreideas.repository.ChapterImageRepository;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.ExplanationMarkRepository;
import com.bookscoreideas.repository.PartRepository;
import com.bookscoreideas.repository.ReadingBookmarkRepository;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Reads a book and everything it owns into its archive snapshot. The one place that
 * walks the book tree: the ZIP migration writes the snapshot as it is, the single-book
 * JSON export maps it to the JSON import format (BE-06/BE-08). Callers provide the
 * (read-only) transaction.
 */
@Component
public class BookArchiveBuilder {

    private final PartRepository partRepository;
    private final ChapterRepository chapterRepository;
    private final ChapterExplanationRepository explanationRepository;
    private final ChapterImageRepository imageRepository;
    private final BookReviewRepository reviewRepository;
    private final ReadingBookmarkRepository bookmarkRepository;
    private final ExplanationMarkRepository markRepository;
    private final ChapterFavoriteRepository favoriteRepository;
    private final BookCollectionRepository collectionRepository;
    private final BookCollectionItemRepository collectionItemRepository;

    public BookArchiveBuilder(PartRepository partRepository, ChapterRepository chapterRepository,
                              ChapterExplanationRepository explanationRepository,
                              ChapterImageRepository imageRepository, BookReviewRepository reviewRepository,
                              ReadingBookmarkRepository bookmarkRepository, ExplanationMarkRepository markRepository,
                              ChapterFavoriteRepository favoriteRepository,
                              BookCollectionRepository collectionRepository,
                              BookCollectionItemRepository collectionItemRepository) {
        this.partRepository = partRepository;
        this.chapterRepository = chapterRepository;
        this.explanationRepository = explanationRepository;
        this.imageRepository = imageRepository;
        this.reviewRepository = reviewRepository;
        this.bookmarkRepository = bookmarkRepository;
        this.markRepository = markRepository;
        this.favoriteRepository = favoriteRepository;
        this.collectionRepository = collectionRepository;
        this.collectionItemRepository = collectionItemRepository;
    }

    public BookArchiveDto build(Book book) {
        boolean isParts = book.isPartsBook();
        List<PartArchiveDto> parts = null;
        List<ChapterArchiveDto> chapters = null;

        if (isParts) {
            parts = new ArrayList<>();
            for (Part part : partRepository.findByBookIdOrderByOrderIndexAsc(book.getId())) {
                List<ChapterArchiveDto> partChapters = new ArrayList<>();
                for (Chapter chapter : chapterRepository.findByPart_IdOrderByOrderIndexAsc(part.getId())) {
                    partChapters.add(buildChapter(chapter));
                }
                parts.add(new PartArchiveDto(part.getTitle(), part.getOrderIndex(), part.getSummary(), partChapters));
            }
            // Chapters outside any part ("Ungrouped" on the book page), BUG-14; absent when there are none.
            List<ChapterArchiveDto> ungrouped = new ArrayList<>();
            for (Chapter chapter : chapterRepository.findByBookIdOrderByOrderIndexAsc(book.getId())) {
                if (chapter.getPartId() == null) ungrouped.add(buildChapter(chapter));
            }
            if (!ungrouped.isEmpty()) chapters = ungrouped;
        } else {
            chapters = new ArrayList<>();
            for (Chapter chapter : chapterRepository.findByBookIdOrderByOrderIndexAsc(book.getId())) {
                chapters.add(buildChapter(chapter));
            }
        }

        List<ReviewArchiveDto> reviews = reviewRepository.findByBookIdOrderByIdAsc(book.getId()).stream()
                .map(r -> new ReviewArchiveDto(r.getTitle(), r.getContent(), text(r.getUpdatedAt())))
                .toList();

        return new BookArchiveDto(
                MigrationService.FORMAT_VERSION,
                book.getTitle(), book.getAuthor(), book.getIsbn(), book.getDescription(),
                book.getCoverUrl(), book.getRating(), book.getCategory(), ReadingStatus.text(book.getReadingStatus()),
                text(book.getDateAdded()), text(book.getStartDate()), text(book.getFinishDate()),
                book.getChapterImagesEnabled(), book.getStructureType().name(), parts, chapters,
                reviews, collectionPaths(book.getId()));
    }

    private ChapterArchiveDto buildChapter(Chapter chapter) {
        Long id = chapter.getId();
        ExplanationArchiveDto explanation = explanationRepository.findByChapterId(id)
                .map(e -> new ExplanationArchiveDto(e.getContent(), text(e.getUpdatedAt())))
                .orElse(null);
        List<ImageArchiveDto> images = imageRepository.findByChapterIdOrderByOrderIndexAsc(id).stream()
                .map(img -> new ImageArchiveDto(img.getFilename(), img.getOriginalName(), img.getContentType(),
                        img.getOrderIndex()))
                .toList();
        List<BookmarkArchiveDto> bookmarks = bookmarkRepository.findByChapterIdOrderByIdAsc(id).stream()
                .map(b -> new BookmarkArchiveDto(b.getScrollRatio(), b.getNote(), text(b.getCreatedAt())))
                .toList();
        List<MarkArchiveDto> marks = markRepository.findByChapterIdOrderByIdAsc(id).stream()
                .map(m -> new MarkArchiveDto(m.getQuote(), m.getPrefix(), m.getSuffix(), m.getStartOffset(),
                        m.getEndOffset(), m.getNote(), text(m.getCreatedAt()), text(m.getUpdatedAt())))
                .toList();
        FavoriteArchiveDto favorite = favoriteRepository.findByChapterId(id)
                .map(f -> new FavoriteArchiveDto(f.getNote(), text(f.getCreatedAt())))
                .orElse(null);

        return new ChapterArchiveDto(chapter.getTitle(), chapter.getOrderIndex(), chapter.getSummary(),
                explanation, images, bookmarks, marks, favorite);
    }

    /** Folder names from the root down for every collection holding the book, sorted. */
    private List<List<String>> collectionPaths(Long bookId) {
        List<BookCollectionItem> items = collectionItemRepository.findByBookId(bookId);
        if (items.isEmpty()) return List.of();
        Map<Long, BookCollection> folders = collectionRepository.findAll().stream()
                .collect(Collectors.toMap(BookCollection::getId, Function.identity()));
        List<List<String>> paths = new ArrayList<>();
        for (BookCollectionItem item : items) {
            LinkedList<String> path = new LinkedList<>();
            Set<Long> seen = new HashSet<>();
            for (BookCollection f = folders.get(item.getCollectionId()); f != null && seen.add(f.getId());
                 f = f.getParentId() == null ? null : folders.get(f.getParentId())) {
                path.addFirst(f.getName());
            }
            if (!path.isEmpty()) paths.add(List.copyOf(path));
        }
        paths.sort(Comparator.comparing(p -> String.join("\u0000", p)));
        return paths;
    }

    private static String text(Object value) {
        return value != null ? value.toString() : null;
    }
}
