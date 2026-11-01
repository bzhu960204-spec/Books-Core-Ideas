package com.bookscoreideas.books;

import com.bookscoreideas.support.IntegrationTest;
import tools.jackson.databind.JsonNode;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Chapter and part endpoints (BE-01 ①): response shape, part assignment, query count. */
class ChapterApiTest extends IntegrationTest {

    @Autowired private EntityManagerFactory entityManagerFactory;

    @Test
    void chapterListHasChaptersAndTheirIdeasInOrder() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Shape"));
        long second = postForId("/api/books/" + book + "/chapters", Map.of("title", "Second", "orderIndex", 2));
        long first = postForId("/api/books/" + book + "/chapters", Map.of("title", "First", "orderIndex", 1, "summary", "S"));
        postForId("/api/chapters/" + first + "/ideas", Map.of("content", "later", "orderIndex", 2));
        postForId("/api/chapters/" + first + "/ideas", Map.of(
                "content", "earlier", "orderIndex", 1, "example", "E", "tags", "t", "highlighted", true));

        JsonNode list = getJson("/api/books/" + book + "/chapters");

        assertThat(list).hasSize(2);
        JsonNode ch = list.get(0);
        assertThat(fieldNames(ch)).containsExactly("id", "title", "orderIndex", "summary", "partId", "keyIdeas");
        assertThat(ch.get("id").asLong()).isEqualTo(first);
        assertThat(ch.get("summary").asString()).isEqualTo("S");
        assertThat(ch.get("partId").isNull()).isTrue();
        JsonNode idea = ch.get("keyIdeas").get(0);
        assertThat(fieldNames(idea)).containsExactly("id", "content", "example", "tags", "highlighted", "orderIndex");
        assertThat(idea.get("content").asString()).isEqualTo("earlier");
        assertThat(idea.get("highlighted").asBoolean()).isTrue();
        assertThat(ch.get("keyIdeas").get(1).get("content").asString()).isEqualTo("later");
        assertThat(list.get(1).get("id").asLong()).isEqualTo(second);
        assertThat(list.get(1).get("keyIdeas")).isEmpty();
    }

    @Test
    void createAndUpdateReturnTheChapterShape() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Parts", "structureType", "PARTS"));
        long part = postForId("/api/books/" + book + "/parts", Map.of("title", "P1", "orderIndex", 1));

        JsonNode created = postJson("/api/books/" + book + "/chapters", Map.of("title", "C", "partId", part));
        assertThat(fieldNames(created)).containsExactly("id", "title", "orderIndex", "summary", "partId", "keyIdeas");
        assertThat(created.get("partId").asLong()).isEqualTo(part);

        Map<String, Object> update = new HashMap<>();
        update.put("title", "C2");
        update.put("partId", null);
        JsonNode updated = putJson("/api/books/" + book + "/chapters/" + created.get("id").asLong(), update);
        assertThat(updated.get("title").asString()).isEqualTo("C2");
        assertThat(updated.get("partId").isNull()).isTrue();
    }

    @Test
    void partFromAnotherBookIsRejected() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Mine"));
        long other = postForId("/api/books", Map.of("title", "Other"));
        long foreignPart = postForId("/api/books/" + other + "/parts", Map.of("title", "Foreign"));

        mockMvc.perform(post("/api/books/" + book + "/chapters").contentType(APPLICATION_JSON)
                        .content("{\"title\":\"C\",\"partId\":" + foreignPart + "}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void partEndpointsUseThePartShape() throws Exception {
        long book = postForId("/api/books", Map.of("title", "P"));
        JsonNode created = postJson("/api/books/" + book + "/parts", Map.of("title", "Part", "orderIndex", 1, "summary", "S"));
        assertThat(fieldNames(created)).containsExactly("id", "title", "orderIndex", "summary");

        JsonNode list = getJson("/api/books/" + book + "/parts");
        assertThat(fieldNames(list.get(0))).containsExactly("id", "title", "orderIndex", "summary");

        JsonNode updated = putJson("/api/books/" + book + "/parts/" + created.get("id").asLong(), Map.of("title", "Part 2"));
        assertThat(updated.get("title").asString()).isEqualTo("Part 2");

        mockMvc.perform(delete("/api/books/" + book + "/parts/" + created.get("id").asLong()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/books/" + book + "/parts")).andExpect(jsonPath("$.length()").value(0));
    }

    // Was 200 [] before BE-03; reads under a missing parent are now 404 (doc/api-conventions.md).
    @Test
    void unknownBookIs404() throws Exception {
        mockMvc.perform(get("/api/books/999999/chapters")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/books/999999/parts")).andExpect(status().isNotFound());
    }

    /** Regression: listing chapters loaded each chapter's ideas with its own query (N+1). */
    @Test
    void chapterListQueryCountDoesNotGrowWithChapters() throws Exception {
        long small = bookWithChapters(1);
        long large = bookWithChapters(6);

        assertThat(statementsFor("/api/books/" + large + "/chapters"))
                .isEqualTo(statementsFor("/api/books/" + small + "/chapters"));
    }

    private long bookWithChapters(int chapters) throws Exception {
        long book = postForId("/api/books", Map.of("title", "N" + chapters));
        for (int i = 1; i <= chapters; i++) {
            long chapter = postForId("/api/books/" + book + "/chapters", Map.of("title", "c" + i, "orderIndex", i));
            postForId("/api/chapters/" + chapter + "/ideas", Map.of("content", "i" + i));
        }
        return book;
    }

    private long statementsFor(String url) throws Exception {
        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        getJson(url);
        return stats.getPrepareStatementCount();
    }

    private static List<String> fieldNames(JsonNode node) {
        List<String> names = new ArrayList<>();
        node.propertyNames().forEach(names::add);
        return names;
    }

    private JsonNode getJson(String url) throws Exception {
        return objectMapper.readTree(mockMvc.perform(get(url))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
}
