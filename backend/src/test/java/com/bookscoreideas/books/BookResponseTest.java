package com.bookscoreideas.books;

import com.bookscoreideas.support.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Response side of the /api/books contract (BE-02): book DTOs without the chapter tree. */
class BookResponseTest extends IntegrationTest {

    @Autowired private EntityManagerFactory entityManagerFactory;

    @Test
    void listReturnsChapterCountInsteadOfTheChapterTree() throws Exception {
        long id = bookWithChapters("Listed", 3);

        JsonNode book = findInList(getJson("/api/books"), id);

        assertThat(book.has("chapters")).isFalse();
        assertThat(book.get("chapterCount").asLong()).isEqualTo(3);
        assertThat(book.get("title").asText()).isEqualTo("Listed");
    }

    @Test
    void bookWithoutChaptersHasZeroCount() throws Exception {
        long id = postForId("/api/books", Map.of("title", "Empty"));

        assertThat(findInList(getJson("/api/books"), id).get("chapterCount").asLong()).isZero();
        assertThat(getJson("/api/books/" + id).get("chapterCount").asLong()).isZero();
    }

    @Test
    void detailCreateAndUpdateResponsesUseTheSameShape() throws Exception {
        long id = bookWithChapters("Detail", 2);

        JsonNode detail = getJson("/api/books/" + id);
        JsonNode updated = putJson("/api/books/" + id, Map.of("title", "Detail 2"));
        JsonNode created = postJson("/api/books", Map.of("title", "Created"));

        for (JsonNode book : new JsonNode[] {detail, updated, created}) {
            assertThat(book.has("chapters")).isFalse();
            assertThat(book.has("chapterCount")).isTrue();
        }
        assertThat(detail.get("chapterCount").asLong()).isEqualTo(2);
        assertThat(updated.get("chapterCount").asLong()).isEqualTo(2);
        assertThat(created.get("chapterCount").asLong()).isZero();
    }

    @Test
    void collectionBooksUseTheListShape() throws Exception {
        long id = bookWithChapters("Collected", 2);
        long folder = postForId("/api/book-collections", Map.of("name", "Shelf"));
        mockMvc.perform(post("/api/book-collections/" + folder + "/books/" + id))
                .andExpect(status().is2xxSuccessful());

        JsonNode book = findInList(getJson("/api/book-collections/" + folder + "/books"), id);

        assertThat(book.has("chapters")).isFalse();
        assertThat(book.get("chapterCount").asLong()).isEqualTo(2);
    }

    /** The UI saves a rating/status by sending the listed book back with one field changed. */
    @Test
    void listedBookCanBeSentBackToPutWithoutLosingFields() throws Exception {
        long id = postForId("/api/books", Map.of(
                "title", "Round trip", "author", "A", "description", "Long description",
                "category", "X;Y", "coverUrl", "https://example.com/c.png", "rating", 3,
                "chapterImagesEnabled", true, "structureType", "PARTS"));
        ObjectNode listed = (ObjectNode) findInList(getJson("/api/books"), id);

        listed.put("rating", 5);
        JsonNode updated = putJson("/api/books/" + id, listed);

        listed.fieldNames().forEachRemaining(field -> assertThat(updated.get(field))
                .as(field).isEqualTo(listed.get(field)));
    }

    /** Regression for the list endpoint loading every chapter and idea (N+1). */
    @Test
    void listQueryCountDoesNotGrowWithTheLibrary() throws Exception {
        bookWithChapters("Seed", 2);
        long before = statementsFor("/api/books");

        for (int i = 0; i < 3; i++) {
            bookWithChapters("More " + i, 3);
        }
        long after = statementsFor("/api/books");

        assertThat(after).isEqualTo(before);
    }

    private long statementsFor(String url) throws Exception {
        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        getJson(url);
        return stats.getPrepareStatementCount();
    }

    private long bookWithChapters(String title, int chapters) throws Exception {
        long id = postForId("/api/books", Map.of("title", title));
        for (int i = 1; i <= chapters; i++) {
            long chapter = postForId("/api/books/" + id + "/chapters", Map.of("title", title + " ch" + i, "orderIndex", i));
            postForId("/api/chapters/" + chapter + "/ideas", Map.of("content", "idea " + i));
        }
        return id;
    }

    private JsonNode findInList(JsonNode list, long id) {
        for (JsonNode book : list) {
            if (book.get("id").asLong() == id) return book;
        }
        throw new AssertionError("book " + id + " not in list");
    }

    private JsonNode getJson(String url) throws Exception {
        return objectMapper.readTree(mockMvc.perform(get(url))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
}
