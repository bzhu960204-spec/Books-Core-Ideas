package com.bookscoreideas.migration;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * DB-01: Flyway is the only source of the schema. A database built from scratch by
 * the migrations and the real (legacy) database, whose tables were originally made
 * by Hibernate, must end up with exactly the same schema, so that Hibernate's
 * ddl-auto=validate (checked against fresh databases by every Spring test) holds
 * for both.
 */
class SchemaConvergenceTest {

    @Test
    void legacyDatabaseEndsUpWithTheSameSchemaAsAFreshOne() throws Exception {
        String fresh = newDatabase();
        flyway(fresh, "0").migrate();

        String legacy = newLegacyDatabaseAtV7();
        flyway(legacy, "7").migrate();

        assertThat(snapshot(legacy)).containsExactlyElementsOf(snapshot(fresh));
    }

    @Test
    void legacyDataSurvivesAndNullFlagsBecomeFalse() throws Exception {
        String legacy = newLegacyDatabaseAtV7();
        try (Connection c = connect(legacy); Statement s = c.createStatement()) {
            s.execute("INSERT INTO BOOKS (ID, TITLE, STRUCTURE_TYPE, CHAPTER_IMAGES_ENABLED) VALUES (1, 'Legacy', NULL, NULL)");
            s.execute("INSERT INTO PARTS (ID, TITLE, BOOK_ID) VALUES (1, 'Part', 1)");
            s.execute("INSERT INTO CHAPTERS (ID, TITLE, SUMMARY, BOOK_ID, PART_ID) VALUES (1, 'Ch', 'long summary', 1, 1)");
            s.execute("INSERT INTO KEY_IDEAS (ID, CONTENT, CHAPTER_ID, HIGHLIGHTED) VALUES (1, 'idea', 1, NULL)");
            s.execute("INSERT INTO EXCERPTS (ID, CONTENT, CHAPTER_ID, HIGHLIGHTED) VALUES (1, 'quote', 1, TRUE)");
            s.execute("INSERT INTO CHAPTER_EXPLANATIONS (ID, CHAPTER_ID, CONTENT) VALUES (1, 1, '<p>expl</p>')");
            s.execute("INSERT INTO BOOK_REVIEWS (ID, BOOK_ID, CONTENT) VALUES (1, 1, 'review')");
            s.execute("INSERT INTO CHAPTER_IMAGES (ID, CHAPTER_ID, FILENAME) VALUES (1, 1, 'a.png')");
            s.execute("INSERT INTO READING_BOOKMARKS (ID, BOOK_ID, CHAPTER_ID, NOTE) VALUES (1, 1, 1, 'here')");
            s.execute("INSERT INTO EXPLANATION_MARKS (ID, BOOK_ID, CHAPTER_ID, QUOTE) VALUES (1, 1, 1, 'q')");
            s.execute("INSERT INTO BOOK_COLLECTIONS (ID, NAME) VALUES (1, 'Folder')");
            s.execute("INSERT INTO BOOK_COLLECTION_ITEMS (ID, COLLECTION_ID, BOOK_ID) VALUES (1, 1, 1)");
        }

        flyway(legacy, "7").migrate();

        try (Connection c = connect(legacy); Statement s = c.createStatement()) {
            assertThat(row(s, "SELECT TITLE, STRUCTURE_TYPE, CHAPTER_IMAGES_ENABLED FROM BOOKS"))
                    .containsExactly("Legacy", "CHAPTERS", "FALSE");
            assertThat(row(s, "SELECT CONTENT, HIGHLIGHTED FROM KEY_IDEAS")).containsExactly("idea", "FALSE");
            assertThat(row(s, "SELECT CONTENT, HIGHLIGHTED FROM EXCERPTS")).containsExactly("quote", "TRUE");
            assertThat(row(s, "SELECT SUMMARY, PART_ID FROM CHAPTERS")).containsExactly("long summary", "1");
            assertThat(row(s, "SELECT CONTENT FROM CHAPTER_EXPLANATIONS")).containsExactly("<p>expl</p>");
            for (String table : List.of("PARTS", "BOOK_REVIEWS", "CHAPTER_IMAGES", "READING_BOOKMARKS",
                    "EXPLANATION_MARKS", "BOOK_COLLECTIONS", "BOOK_COLLECTION_ITEMS")) {
                assertThat(row(s, "SELECT COUNT(*) FROM " + table)).as(table).containsExactly("1");
            }
        }
    }

    @Test
    void unknownConstraintAbortsV8BeforeChangingAnything() throws Exception {
        String legacy = newLegacyDatabaseAtV7();
        try (Connection c = connect(legacy); Statement s = c.createStatement()) {
            s.execute("ALTER TABLE BOOKS ADD CONSTRAINT UK_SURPRISE UNIQUE (ISBN)");
        }

        assertThatThrownBy(() -> flyway(legacy, "7").migrate())
                .isInstanceOf(FlywayException.class)
                .hasMessageContaining("V8 aborted: unexpected constraint BOOKS.UK_SURPRISE");

        try (Connection c = connect(legacy); Statement s = c.createStatement()) {
            assertThat(row(s, "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS "
                    + "WHERE CONSTRAINT_NAME = 'FKED84IWJ3KFAGV35ULS80TXKJ4'")).containsExactly("1");
        }
    }

    private static String newDatabase() {
        return "jdbc:h2:mem:schema-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1";
    }

    /** The real database's schema just before V8; Flyway history baselined at 7. */
    private static String newLegacyDatabaseAtV7() throws SQLException {
        String url = newDatabase();
        try (Connection c = connect(url); Statement s = c.createStatement()) {
            s.execute("RUNSCRIPT FROM 'classpath:db/legacy-schema-v7.sql'");
        }
        return url;
    }

    private static Flyway flyway(String url, String baselineVersion) {
        return Flyway.configure()
                .dataSource(url, "sa", "")
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .baselineVersion(baselineVersion)
                .load();
    }

    private static List<String> snapshot(String url) throws SQLException {
        try (Connection c = connect(url)) {
            return SchemaSnapshot.of(c);
        }
    }

    private static Connection connect(String url) throws SQLException {
        return DriverManager.getConnection(url, "sa", "");
    }

    private static List<String> row(Statement s, String sql) throws SQLException {
        try (ResultSet rs = s.executeQuery(sql)) {
            assertThat(rs.next()).as(sql).isTrue();
            List<String> values = new ArrayList<>();
            for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++) {
                values.add(rs.getString(i));
            }
            assertThat(rs.next()).as(sql + " returns one row").isFalse();
            return values;
        }
    }
}
