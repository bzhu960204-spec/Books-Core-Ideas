package com.bookscoreideas.books;

import com.bookscoreideas.support.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Key idea and excerpt endpoints, including the global banks (BE-01 ②). */
class ContentApiTest extends IntegrationTest {

    private static final List<String> IDEA_FIELDS = List.of("id", "content", "example", "tags", "highlighted", "orderIndex");
    private static final List<String> EXCERPT_FIELDS = List.of("id", "content", "note", "source", "orderIndex", "highlighted");
    private static final List<String> SEARCH_TAIL = List.of("orderIndex", "chapterId", "chapterTitle", "bookId", "bookTitle", "bookAuthor");

    private long book;
    private long chapter;

    @BeforeEach
    void chapter() throws Exception {
        book = postForId("/api/books", Map.of("title", "Content " + System.nanoTime(), "author", "Writer"));
        chapter = postForId("/api/books/" + book + "/chapters", Map.of("title", "Ch"));
    }

    @Test
    void ideaLifecycleKeepsTheIdeaShape() throws Exception {
        String base = "/api/chapters/" + chapter + "/ideas";
        postForId(base, Map.of("content", "second", "orderIndex", 2));
        JsonNode created = postJson(base, Map.of("content", "first", "example", "E", "tags", "a,b",
                "highlighted", true, "orderIndex", 1));
        assertThat(fieldNames(created)).isEqualTo(IDEA_FIELDS);
        assertThat(created.get("highlighted").asBoolean()).isTrue();

        JsonNode list = getJson(base);
        assertThat(fieldNames(list.get(0))).isEqualTo(IDEA_FIELDS);
        assertThat(list.get(0).get("content").asText()).isEqualTo("first");
        assertThat(list.get(1).get("content").asText()).isEqualTo("second");

        long id = created.get("id").asLong();
        JsonNode updated = putJson(base + "/" + id, Map.of("content", "edited"));
        assertThat(updated.get("content").asText()).isEqualTo("edited");
        assertThat(updated.get("highlighted").asBoolean()).isFalse();
        assertThat(updated.get("example").isNull()).isTrue();

        mockMvc.perform(delete(base + "/" + id)).andExpect(status().isOk());
        mockMvc.perform(get(base)).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void excerptLifecycleKeepsTheExcerptShape() throws Exception {
        String base = "/api/chapters/" + chapter + "/excerpts";
        JsonNode created = postJson(base, Map.of("content", "quote", "note", "N", "source", "p.1",
                "orderIndex", 1, "highlighted", true));
        assertThat(fieldNames(created)).isEqualTo(EXCERPT_FIELDS);

        JsonNode list = getJson(base);
        assertThat(fieldNames(list.get(0))).isEqualTo(EXCERPT_FIELDS);

        long id = created.get("id").asLong();
        JsonNode updated = putJson(base + "/" + id, Map.of("content", "edited", "highlighted", true));
        assertThat(updated.get("content").asText()).isEqualTo("edited");
        assertThat(updated.get("note").isNull()).isTrue();

        mockMvc.perform(delete(base + "/" + id)).andExpect(status().isOk());
        mockMvc.perform(get(base)).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void creatingUnderAMissingChapterIs404() throws Exception {
        mockMvc.perform(post("/api/chapters/999999/ideas").contentType(APPLICATION_JSON).content("{\"content\":\"x\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/chapters/999999/excerpts").contentType(APPLICATION_JSON).content("{\"content\":\"x\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void banksListOnlyHighlightedItemsWithTheirBook() throws Exception {
        postForId("/api/chapters/" + chapter + "/ideas", Map.of("content", "banked idea", "tags", "focus", "highlighted", true));
        postForId("/api/chapters/" + chapter + "/ideas", Map.of("content", "private idea"));
        postForId("/api/chapters/" + chapter + "/excerpts", Map.of("content", "banked quote", "highlighted", true));
        postForId("/api/chapters/" + chapter + "/excerpts", Map.of("content", "private quote"));

        JsonNode ideas = getJson("/api/ideas?bookId=" + book);
        assertThat(ideas).hasSize(1);
        assertThat(fieldNames(ideas.get(0))).endsWith(SEARCH_TAIL.toArray(String[]::new));
        assertThat(ideas.get(0).get("bookAuthor").asText()).isEqualTo("Writer");
        assertThat(getJson("/api/ideas?bookId=" + book + "&tag=focus")).hasSize(1);
        assertThat(getJson("/api/ideas?bookId=" + book + "&q=nothing-matches")).isEmpty();

        JsonNode excerpts = getJson("/api/excerpts?bookId=" + book);
        assertThat(excerpts).hasSize(1);
        assertThat(fieldNames(excerpts.get(0))).endsWith(SEARCH_TAIL.toArray(String[]::new));
        assertThat(getJson("/api/excerpts?bookId=" + book + "&q=banked")).hasSize(1);
    }

    private static List<String> fieldNames(JsonNode node) {
        List<String> names = new ArrayList<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }

    private JsonNode getJson(String url) throws Exception {
        return objectMapper.readTree(mockMvc.perform(get(url))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
}
