package com.bookscoreideas.service;

import com.bookscoreideas.dto.BookmarkDto;
import com.bookscoreideas.entity.ReadingBookmark;
import com.bookscoreideas.repository.BookRepository;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.ReadingBookmarkRepository;
import com.bookscoreideas.web.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Reading history as manual bookmarks on chapter explanations. Creating a
 * bookmark records "I read up to here" (chapter + scroll position + time); the
 * latest bookmark per book powers "continue reading", and the full list powers
 * the reading-history timeline.
 */
@Service
public class BookmarkService {

    private final ReadingBookmarkRepository bookmarkRepository;
    private final ChapterRepository chapterRepository;
    private final BookRepository bookRepository;

    public BookmarkService(ReadingBookmarkRepository bookmarkRepository, ChapterRepository chapterRepository,
                           BookRepository bookRepository) {
        this.bookmarkRepository = bookmarkRepository;
        this.chapterRepository = chapterRepository;
        this.bookRepository = bookRepository;
    }

    /** @return empty if the chapter does not exist */
    @Transactional
    public Optional<BookmarkDto> create(Long chapterId, Double scrollRatio, String note) {
        return chapterRepository.findById(chapterId).map(chapter -> {
            ReadingBookmark bookmark = new ReadingBookmark();
            bookmark.setChapter(chapter);
            bookmark.setBook(chapter.getBook());
            bookmark.setScrollRatio(scrollRatio);
            bookmark.setNote(note);
            return BookmarkDto.from(bookmarkRepository.save(bookmark));
        });
    }

    @Transactional(readOnly = true)
    public Optional<BookmarkDto> latest(Long bookId) {
        NotFoundException.requireExists(bookRepository.existsById(bookId), "Book", bookId);
        return bookmarkRepository.findFirstByBookIdOrderByCreatedAtDescIdDesc(bookId).map(BookmarkDto::from);
    }

    /** Newest first; every book's bookmarks when {@code bookId} is null. */
    @Transactional(readOnly = true)
    public List<BookmarkDto> list(Long bookId) {
        return bookmarkRepository.findRows(bookId).stream()
                .map(r -> BookmarkDto.of(r.getId(), r.getChapterId(), r.getChapterTitle(), r.getBookId(),
                        r.getBookTitle(), r.getBookAuthor(), r.getBookCoverUrl(), r.getScrollRatio(),
                        r.getNote(), r.getCreatedAt()))
                .toList();
    }

    /** @return false if the bookmark does not exist */
    @Transactional
    public boolean delete(Long id) {
        if (!bookmarkRepository.existsById(id)) return false;
        bookmarkRepository.deleteById(id);
        return true;
    }
}
