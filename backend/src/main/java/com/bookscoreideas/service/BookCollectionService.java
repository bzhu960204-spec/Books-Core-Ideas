package com.bookscoreideas.service;

import com.bookscoreideas.entity.Book;
import com.bookscoreideas.entity.BookCollection;
import com.bookscoreideas.entity.BookCollectionItem;
import com.bookscoreideas.repository.BookCollectionItemRepository;
import com.bookscoreideas.repository.BookCollectionRepository;
import com.bookscoreideas.repository.BookRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * CRUD for nested book collections (file-system-like folders) plus
 * book-membership management: a folder tree formed by {@code parentId} and a
 * many-to-many membership join table.
 */
@Service
@Transactional
public class BookCollectionService {

    private final BookCollectionRepository repo;
    private final BookCollectionItemRepository itemRepo;
    private final BookRepository bookRepo;

    public BookCollectionService(BookCollectionRepository repo,
                                 BookCollectionItemRepository itemRepo,
                                 BookRepository bookRepo) {
        this.repo = repo;
        this.itemRepo = itemRepo;
        this.bookRepo = bookRepo;
    }

    @Transactional(readOnly = true)
    public List<BookCollection> list() {
        return repo.findAllByOrderBySortOrderAscNameAsc();
    }

    @Transactional(readOnly = true)
    public BookCollection get(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new RuntimeException("Collection not found: " + id));
    }

    public BookCollection create(String name, Long parentId, Integer sortOrder) {
        String n = sanitizeName(name);
        if (parentId != null) get(parentId); // verify it exists
        BookCollection c = new BookCollection();
        c.setName(n);
        c.setParentId(parentId);
        c.setSortOrder(sortOrder != null ? sortOrder : 0);
        return repo.save(c);
    }

    /**
     * Update name/sortOrder only. Reparenting lives in {@link #move(Long, Long)}:
     * a missing {@code parentId} in the body is indistinguishable from an explicit
     * null, so folding it in here would silently move a renamed folder to the root.
     */
    public BookCollection update(Long id, String name, Integer sortOrder) {
        BookCollection c = get(id);
        if (name != null) c.setName(sanitizeName(name));
        if (sortOrder != null) c.setSortOrder(sortOrder);
        return repo.save(c);
    }

    /** Reparent a collection. {@code parentId == null} moves it to the root. */
    public BookCollection move(Long id, Long parentId) {
        BookCollection c = get(id);
        if (parentId != null) {
            if (parentId.equals(id)) {
                throw new IllegalArgumentException("Cannot set a collection as its own parent");
            }
            get(parentId); // verify it exists
            if (descendantIds(id).contains(parentId)) {
                throw new IllegalArgumentException("Cannot move a collection under one of its descendants");
            }
        }
        c.setParentId(parentId);
        return repo.save(c);
    }

    public void delete(Long id) {
        BookCollection c = get(id);
        Set<Long> all = new HashSet<>();
        all.add(c.getId());
        all.addAll(descendantIds(id));
        List<Long> ids = new ArrayList<>(all);
        itemRepo.deleteByCollectionIdIn(ids);
        repo.deleteAllById(ids);
    }

    @Transactional(readOnly = true)
    public List<Book> booksIn(Long collectionId, boolean includeDescendants) {
        get(collectionId);
        List<Long> ids = new ArrayList<>();
        ids.add(collectionId);
        if (includeDescendants) ids.addAll(descendantIds(collectionId));
        List<BookCollectionItem> items = itemRepo.findByCollectionIdIn(ids);
        if (items.isEmpty()) return List.of();
        // Preserve insertion order and de-duplicate across aggregated folders.
        Set<Long> bookIds = items.stream()
                .map(BookCollectionItem::getBookId)
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
        Map<Long, Book> byId = bookRepo.findAllById(bookIds).stream()
                .collect(Collectors.toMap(Book::getId, b -> b));
        List<Book> out = new ArrayList<>();
        for (Long bookId : bookIds) {
            Book b = byId.get(bookId);
            if (b != null) out.add(b);
        }
        return out;
    }

    public void addBook(Long collectionId, Long bookId) {
        get(collectionId);
        bookRepo.findById(bookId)
                .orElseThrow(() -> new RuntimeException("Book not found: " + bookId));
        if (itemRepo.existsByCollectionIdAndBookId(collectionId, bookId)) return;
        BookCollectionItem item = new BookCollectionItem();
        item.setCollectionId(collectionId);
        item.setBookId(bookId);
        itemRepo.save(item);
    }

    public void removeBook(Long collectionId, Long bookId) {
        get(collectionId);
        itemRepo.deleteByCollectionIdAndBookId(collectionId, bookId);
    }

    /** Collection ids that the given book is a direct member of. */
    @Transactional(readOnly = true)
    public List<Long> collectionIdsForBook(Long bookId) {
        Set<Long> existing = list().stream().map(BookCollection::getId).collect(Collectors.toSet());
        return itemRepo.findByBookId(bookId).stream()
                .map(BookCollectionItem::getCollectionId)
                .filter(existing::contains)
                .toList();
    }

    /** Direct book-membership counts per collection — used to render badges. */
    @Transactional(readOnly = true)
    public Map<Long, Long> directMemberCounts() {
        List<BookCollection> all = list();
        if (all.isEmpty()) return Map.of();
        List<Long> ids = all.stream().map(BookCollection::getId).toList();
        List<BookCollectionItem> items = itemRepo.findByCollectionIdIn(ids);
        if (items.isEmpty()) return Map.of();
        // Deleting a book does not remove its membership rows, so count only items
        // whose book still exists to avoid badges counting orphaned entries.
        Set<Long> bookIds = items.stream()
                .map(BookCollectionItem::getBookId)
                .collect(Collectors.toSet());
        Set<Long> existing = bookRepo.findAllById(bookIds).stream()
                .map(Book::getId)
                .collect(Collectors.toSet());
        Map<Long, Long> counts = new LinkedHashMap<>();
        for (BookCollectionItem it : items) {
            if (existing.contains(it.getBookId())) {
                counts.merge(it.getCollectionId(), 1L, Long::sum);
            }
        }
        return counts;
    }

    // ---- helpers --------------------------------------------------------------

    private Set<Long> descendantIds(Long rootId) {
        List<BookCollection> all = list();
        Map<Long, List<Long>> childrenByParent = new HashMap<>();
        for (BookCollection c : all) {
            childrenByParent.computeIfAbsent(c.getParentId(), k -> new ArrayList<>()).add(c.getId());
        }
        Set<Long> out = new HashSet<>();
        Deque<Long> q = new ArrayDeque<>();
        q.add(rootId);
        while (!q.isEmpty()) {
            Long cur = q.poll();
            List<Long> kids = childrenByParent.get(cur);
            if (kids == null) continue;
            for (Long k : kids) {
                if (out.add(k)) q.add(k);
            }
        }
        return out;
    }

    private static String sanitizeName(String name) {
        if (name == null) throw new IllegalArgumentException("name is required");
        String trimmed = name.trim();
        if (trimmed.isEmpty()) throw new IllegalArgumentException("name cannot be blank");
        if (trimmed.length() > 200) throw new IllegalArgumentException("name too long");
        return trimmed;
    }
}
