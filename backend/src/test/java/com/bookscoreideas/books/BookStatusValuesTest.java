package com.bookscoreideas.books;

import com.bookscoreideas.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * DB-06: a book's reading status and structure are enums. "Not set" is stored one
 * way, as NULL (it used to be either "" or NULL); clients may still send "" for it
 * (the book form, old JSON exports), and always get null back. The database itself
 * rejects any other value.
 */
class BookStatusValuesTest extends IntegrationTest {

    @Autowired private JdbcTemplate jdbc;

    @Test
    void emptyReadingStatusIsStoredAndReturnedAsNull() throws Exception {
        JsonNode created = postJson("/api/books", Map.of("title", "Unset " + System.nanoTime(), "readingStatus", ""));
        long id = created.get("id").asLong();
        assertThat(created.get("readingStatus").isNull()).isTrue();
        assertThat(storedStatus(id)).isNull();

        JsonNode reading = putJson("/api/books/" + id, Map.of("title", "t", "readingStatus", "READING"));
        assertThat(reading.get("readingStatus").asString()).isEqualTo("READING");
        assertThat(storedStatus(id)).isEqualTo("READING");

        // The status control's "Clear status" sends "".
        JsonNode cleared = putJson("/api/books/" + id, Map.of("title", "t", "readingStatus", ""));
        assertThat(cleared.get("readingStatus").isNull()).isTrue();
        assertThat(storedStatus(id)).isNull();
        assertThat(getJson("/api/books/" + id).get("readingStatus").isNull()).isTrue();
    }

    @Test
    void jsonImportStoresAnEmptyReadingStatusAsNull() throws Exception {
        Map<String, Object> book = new HashMap<>();
        book.put("title", "Imported unset " + System.nanoTime());
        book.put("readingStatus", "");
        JsonNode imported = postJson("/api/books/import", Map.of("books", List.of(book)));

        long id = imported.get(0).get("id").asLong();
        assertThat(imported.get(0).get("readingStatus").isNull()).isTrue();
        assertThat(storedStatus(id)).isNull();
    }

    @Test
    void structureTypeIsUnchangedInTheApi() throws Exception {
        JsonNode parts = postJson("/api/books", Map.of("title", "Parts " + System.nanoTime(), "structureType", "PARTS"));
        assertThat(parts.get("structureType").asString()).isEqualTo("PARTS");
        JsonNode plain = postJson("/api/books", Map.of("title", "Plain " + System.nanoTime()));
        assertThat(plain.get("structureType").asString()).isEqualTo("CHAPTERS");
        JsonNode switched = putJson("/api/books/" + plain.get("id").asLong(),
                Map.of("title", "t", "structureType", "PARTS"));
        assertThat(switched.get("structureType").asString()).isEqualTo("PARTS");
    }

    @Test
    void databaseRejectsUnknownValues() {
        assertRejected("INSERT INTO BOOKS (TITLE, READING_STATUS) VALUES ('x', 'DONE')");
        assertRejected("INSERT INTO BOOKS (TITLE, READING_STATUS) VALUES ('x', '')");
        assertRejected("INSERT INTO BOOKS (TITLE, STRUCTURE_TYPE) VALUES ('x', 'parts')");
        assertThat(jdbc.update("INSERT INTO BOOKS (TITLE, READING_STATUS, STRUCTURE_TYPE) "
                + "VALUES ('SQL ok', 'WANT_TO_READ', 'PARTS')")).isOne();
        assertThat(jdbc.update("INSERT INTO BOOKS (TITLE, READING_STATUS) VALUES ('SQL unset', NULL)")).isOne();
    }

    private String storedStatus(long id) {
        return jdbc.queryForObject("SELECT READING_STATUS FROM BOOKS WHERE ID = ?", String.class, id);
    }

    private JsonNode getJson(String url) throws Exception {
        return objectMapper.readTree(mockMvc.perform(get(url)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    private void assertRejected(String sql) {
        assertThatThrownBy(() -> jdbc.update(sql)).as(sql).isInstanceOf(DataIntegrityViolationException.class);
    }
}
