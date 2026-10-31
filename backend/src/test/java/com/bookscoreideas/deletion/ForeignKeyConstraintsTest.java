package com.bookscoreideas.deletion;

import com.bookscoreideas.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;

import java.sql.PreparedStatement;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * DB-02: the database itself keeps the data consistent, independently of JPA
 * (manual SQL, bulk deletes, future code paths). Deleting an owner cascades to
 * everything it owns, except chapter images: their files are only removed by the
 * JPA entity listener, so the database refuses to drop image rows behind its back.
 * Rows can't point at missing owners, and the redundant book_id columns must agree
 * with the chapter/part they belong to.
 */
class ForeignKeyConstraintsTest extends IntegrationTest {

    @Autowired private JdbcTemplate jdbc;

    @Test
    void deletingABookInSqlRemovesEverythingItOwns() {
        long book = book();
        long part = insert("INSERT INTO PARTS (TITLE, BOOK_ID) VALUES ('P', ?)", book);
        long chapter = insert("INSERT INTO CHAPTERS (TITLE, BOOK_ID, PART_ID) VALUES ('C', ?, ?)", book, part);
        long plainChapter = insert("INSERT INTO CHAPTERS (TITLE, BOOK_ID) VALUES ('C2', ?)", book);
        insert("INSERT INTO KEY_IDEAS (CONTENT, CHAPTER_ID) VALUES ('i', ?)", chapter);
        insert("INSERT INTO EXCERPTS (CONTENT, CHAPTER_ID) VALUES ('e', ?)", chapter);
        insert("INSERT INTO CHAPTER_EXPLANATIONS (CONTENT, CHAPTER_ID) VALUES ('x', ?)", chapter);
        insert("INSERT INTO BOOK_REVIEWS (CONTENT, BOOK_ID) VALUES ('r', ?)", book);
        insert("INSERT INTO READING_BOOKMARKS (BOOK_ID, CHAPTER_ID) VALUES (?, ?)", book, chapter);
        insert("INSERT INTO EXPLANATION_MARKS (BOOK_ID, CHAPTER_ID, QUOTE) VALUES (?, ?, 'q')", book, plainChapter);
        long folder = insert("INSERT INTO BOOK_COLLECTIONS (NAME) VALUES ('F')");
        insert("INSERT INTO BOOK_COLLECTION_ITEMS (COLLECTION_ID, BOOK_ID) VALUES (?, ?)", folder, book);

        jdbc.update("DELETE FROM BOOKS WHERE ID = ?", book);

        assertThat(count("PARTS WHERE BOOK_ID = ?", book)).isZero();
        assertThat(count("CHAPTERS WHERE BOOK_ID = ?", book)).isZero();
        assertThat(count("KEY_IDEAS WHERE CHAPTER_ID = ?", chapter)).isZero();
        assertThat(count("EXCERPTS WHERE CHAPTER_ID = ?", chapter)).isZero();
        assertThat(count("CHAPTER_EXPLANATIONS WHERE CHAPTER_ID = ?", chapter)).isZero();
        assertThat(count("BOOK_REVIEWS WHERE BOOK_ID = ?", book)).isZero();
        assertThat(count("READING_BOOKMARKS WHERE BOOK_ID = ?", book)).isZero();
        assertThat(count("EXPLANATION_MARKS WHERE BOOK_ID = ?", book)).isZero();
        assertThat(count("BOOK_COLLECTION_ITEMS WHERE BOOK_ID = ?", book)).isZero();
        assertThat(count("BOOK_COLLECTIONS WHERE ID = ?", folder)).isOne();
    }

    @Test
    void deletingAPartInSqlRemovesItsChapters() {
        long book = book();
        long part = insert("INSERT INTO PARTS (TITLE, BOOK_ID) VALUES ('P', ?)", book);
        long chapter = insert("INSERT INTO CHAPTERS (TITLE, BOOK_ID, PART_ID) VALUES ('C', ?, ?)", book, part);
        insert("INSERT INTO KEY_IDEAS (CONTENT, CHAPTER_ID) VALUES ('i', ?)", chapter);

        jdbc.update("DELETE FROM PARTS WHERE ID = ?", part);

        assertThat(count("CHAPTERS WHERE ID = ?", chapter)).isZero();
        assertThat(count("KEY_IDEAS WHERE CHAPTER_ID = ?", chapter)).isZero();
        assertThat(count("BOOKS WHERE ID = ?", book)).isOne();
    }

    @Test
    void imageRowsAreNeverDroppedBehindTheFileCleanup() {
        long book = book();
        long chapter = insert("INSERT INTO CHAPTERS (TITLE, BOOK_ID) VALUES ('C', ?)", book);
        long image = insert("INSERT INTO CHAPTER_IMAGES (FILENAME, CHAPTER_ID) VALUES ('f.png', ?)", chapter);

        assertThatThrownBy(() -> jdbc.update("DELETE FROM CHAPTERS WHERE ID = ?", chapter))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("DELETE FROM BOOKS WHERE ID = ?", book))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(count("CHAPTER_IMAGES WHERE ID = ?", image)).isOne();
        assertThat(count("CHAPTERS WHERE ID = ?", chapter)).isOne();
    }

    @Test
    void deletingACollectionInSqlRemovesItsSubtreeAndMemberships() {
        long book = book();
        long root = insert("INSERT INTO BOOK_COLLECTIONS (NAME) VALUES ('Root')");
        long child = insert("INSERT INTO BOOK_COLLECTIONS (NAME, PARENT_ID) VALUES ('Child', ?)", root);
        long grandchild = insert("INSERT INTO BOOK_COLLECTIONS (NAME, PARENT_ID) VALUES ('Grandchild', ?)", child);
        insert("INSERT INTO BOOK_COLLECTION_ITEMS (COLLECTION_ID, BOOK_ID) VALUES (?, ?)", grandchild, book);

        jdbc.update("DELETE FROM BOOK_COLLECTIONS WHERE ID = ?", root);

        assertThat(count("BOOK_COLLECTIONS WHERE ID IN (?, ?)", child, grandchild)).isZero();
        assertThat(count("BOOK_COLLECTION_ITEMS WHERE BOOK_ID = ?", book)).isZero();
        assertThat(count("BOOKS WHERE ID = ?", book)).isOne();
    }

    @Test
    void rowsCannotPointAtMissingOwners() {
        long book = book();
        long folder = insert("INSERT INTO BOOK_COLLECTIONS (NAME) VALUES ('F')");
        long missing = 987654321L;

        assertRejected("INSERT INTO BOOK_COLLECTION_ITEMS (COLLECTION_ID, BOOK_ID) VALUES (?, ?)", folder, missing);
        assertRejected("INSERT INTO BOOK_COLLECTION_ITEMS (COLLECTION_ID, BOOK_ID) VALUES (?, ?)", missing, book);
        assertRejected("INSERT INTO BOOK_COLLECTIONS (NAME, PARENT_ID) VALUES ('Orphan', ?)", missing);
    }

    @Test
    void childRowsNeedAnOwner() {
        assertRejected("INSERT INTO PARTS (TITLE) VALUES ('P')");
        assertRejected("INSERT INTO CHAPTERS (TITLE) VALUES ('C')");
        assertRejected("INSERT INTO KEY_IDEAS (CONTENT) VALUES ('i')");
        assertRejected("INSERT INTO EXCERPTS (CONTENT) VALUES ('e')");
        assertRejected("INSERT INTO CHAPTER_IMAGES (FILENAME) VALUES ('f.png')");
    }

    @Test
    void redundantBookIdsMustMatchTheChapterOrPart() {
        long book = book();
        long otherBook = book();
        long chapter = insert("INSERT INTO CHAPTERS (TITLE, BOOK_ID) VALUES ('C', ?)", book);
        long otherPart = insert("INSERT INTO PARTS (TITLE, BOOK_ID) VALUES ('P', ?)", otherBook);

        assertRejected("INSERT INTO READING_BOOKMARKS (BOOK_ID, CHAPTER_ID) VALUES (?, ?)", otherBook, chapter);
        assertRejected("INSERT INTO EXPLANATION_MARKS (BOOK_ID, CHAPTER_ID, QUOTE) VALUES (?, ?, 'q')", otherBook, chapter);
        assertRejected("INSERT INTO CHAPTERS (TITLE, BOOK_ID, PART_ID) VALUES ('C', ?, ?)", book, otherPart);
        assertRejected("UPDATE CHAPTERS SET PART_ID = ? WHERE ID = ?", otherPart, chapter);
    }

    private long book() {
        return insert("INSERT INTO BOOKS (TITLE) VALUES ('FK test')");
    }

    private long insert(String sql, Object... args) {
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(sql, new String[]{"ID"});
            for (int i = 0; i < args.length; i++) {
                ps.setObject(i + 1, args[i]);
            }
            return ps;
        }, keys);
        Map<String, Object> generated = keys.getKeys();
        return generated == null ? -1 : ((Number) generated.values().iterator().next()).longValue();
    }

    private long count(String fromWhere, Object... args) {
        Long n = jdbc.queryForObject("SELECT COUNT(*) FROM " + fromWhere, Long.class, args);
        return n == null ? 0 : n;
    }

    private void assertRejected(String sql, Object... args) {
        assertThatThrownBy(() -> jdbc.update(sql, args))
                .as(sql)
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
