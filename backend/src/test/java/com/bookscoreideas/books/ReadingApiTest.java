package com.bookscoreideas.books;

import com.bookscoreideas.support.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Explanations, reviews, bookmarks and saved passages (BE-01 ③). */
class ReadingApiTest extends IntegrationTest {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private EntityManagerFactory entityManagerFactory;

    private long book;
    private long chapter;

    @BeforeEach
    void bookWithChapter() throws Exception {
        book = postForId("/api/books", Map.of("title", "Reading " + System.nanoTime(), "author", "Au", "coverUrl", "c.png"));
        chapter = postForId("/api/books/" + book + "/chapters", Map.of("title", "Ch", "orderIndex", 1));
    }

    @Test
    void explanationUpsertReadAndDelete() throws Exception {
        String url = "/api/chapters/" + chapter + "/explanation";
        mockMvc.perform(get(url)).andExpect(status().isNoContent());

        JsonNode saved = putJson(url, Map.of("content", "<p>v1</p>"));
        assertThat(fieldNames(saved)).containsExactlyInAnyOrder("id", "chapterId", "content", "updatedAt");
        assertThat(saved.get("chapterId").asLong()).isEqualTo(chapter);
        assertThat(getJson(url).get("content").asText()).isEqualTo("<p>v1</p>");
        assertThat(getJson("/api/books/" + book + "/explanation-chapter-ids").get(0).asLong()).isEqualTo(chapter);

        jdbc.update("UPDATE chapter_explanations SET updated_at = DATE '2020-01-01' WHERE id = ?", saved.get("id").asLong());
        JsonNode updated = putJson(url, Map.of("content", "<p>v2</p>"));
        assertThat(updated.get("id").asLong()).isEqualTo(saved.get("id").asLong());
        assertThat(updated.get("updatedAt").asText()).isEqualTo(LocalDate.now().toString());
        assertThat(putJson(url, Map.of()).get("content").asText()).isEmpty();

        putMissing("/api/chapters/999999/explanation", "{\"content\":\"x\"}");

        postForId("/api/chapters/" + chapter + "/marks", Map.of("quote", "q"));
        mockMvc.perform(delete(url)).andExpect(status().isNoContent());
        mockMvc.perform(get(url)).andExpect(status().isNoContent());
        assertThat(getJson("/api/chapters/" + chapter + "/marks")).isEmpty();
        mockMvc.perform(delete(url)).andExpect(status().isNotFound());
    }

    @Test
    void reviewsLifecycleAndBank() throws Exception {
        String url = "/api/books/" + book + "/reviews";
        JsonNode created = postJson(url, Map.of("title", "T", "content", "<p>body</p>"));
        assertThat(fieldNames(created)).containsExactlyInAnyOrder("id", "bookId", "title", "content", "updatedAt");
        long id = created.get("id").asLong();
        postJson(url, Map.of("title", "Empty"));

        jdbc.update("UPDATE book_reviews SET updated_at = DATE '2020-01-01' WHERE id = ?", id);
        JsonNode updated = putJson(url + "/" + id, Map.of("title", "T2"));
        assertThat(updated.get("title").asText()).isEqualTo("T2");
        assertThat(updated.get("content").asText()).isEqualTo("<p>body</p>");
        assertThat(updated.get("updatedAt").asText()).isEqualTo(LocalDate.now().toString());

        JsonNode list = getJson(url);
        assertThat(list).hasSize(2);

        long other = postForId("/api/books", Map.of("title", "Other"));
        putMissing("/api/books/" + other + "/reviews/" + id, "{\"title\":\"x\"}");
        mockMvc.perform(delete("/api/books/" + other + "/reviews/" + id)).andExpect(status().isNotFound());

        JsonNode bank = getJson("/api/reviews");
        JsonNode entry = find(bank, id);
        assertThat(fieldNames(entry)).containsExactlyInAnyOrder(
                "id", "bookId", "bookTitle", "bookAuthor", "bookCoverUrl", "title", "content", "updatedAt");
        assertThat(entry.get("bookAuthor").asText()).isEqualTo("Au");
        assertThat(bank).noneMatch(r -> r.get("title").asText().equals("Empty") && r.get("bookId").asLong() == book);

        mockMvc.perform(delete(url + "/" + id)).andExpect(status().isNoContent());
        mockMvc.perform(delete(url + "/" + id)).andExpect(status().isNotFound());
    }

    @Test
    void bookmarksRecordHistory() throws Exception {
        mockMvc.perform(get("/api/books/" + book + "/bookmarks/latest")).andExpect(status().isNoContent());
        JsonNode first = postJson("/api/chapters/" + chapter + "/bookmarks", Map.of("scrollRatio", 0.25, "note", "  start  "));
        assertThat(fieldNames(first)).containsExactlyInAnyOrder("id", "chapterId", "chapterTitle", "bookId", "bookTitle",
                "bookAuthor", "bookCoverUrl", "scrollRatio", "note", "createdAt");
        assertThat(first.get("note").asText()).isEqualTo("start");
        assertThat(first.get("chapterTitle").asText()).isEqualTo("Ch");
        JsonNode second = postJson("/api/chapters/" + chapter + "/bookmarks", Map.of("scrollRatio", "not a number"));
        assertThat(second.get("scrollRatio").isNull()).isTrue();
        assertThat(second.get("note").asText()).isEmpty();

        assertThat(getJson("/api/books/" + book + "/bookmarks/latest").get("id").asLong())
                .isEqualTo(second.get("id").asLong());
        JsonNode list = getJson("/api/bookmarks?bookId=" + book);
        assertThat(list).hasSize(2);
        assertThat(list.get(0).get("id").asLong()).isEqualTo(second.get("id").asLong());
        assertThat(find(getJson("/api/bookmarks"), first.get("id").asLong())).isNotNull();

        mockMvc.perform(post("/api/chapters/999999/bookmarks").contentType(APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/bookmarks/" + first.get("id").asLong())).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/bookmarks/" + first.get("id").asLong())).andExpect(status().isNotFound());
    }

    @Test
    void savedPassages() throws Exception {
        long chapter2 = postForId("/api/books/" + book + "/chapters", Map.of("title", "Ch2", "orderIndex", 2));
        mockMvc.perform(post("/api/chapters/" + chapter + "/marks").contentType(APPLICATION_JSON).content("{\"quote\":\" \"}"))
                .andExpect(status().isBadRequest());

        postJson("/api/chapters/" + chapter2 + "/marks", Map.of("quote", "later chapter", "startOffset", 1));
        Map<String, Object> body = new HashMap<>();
        body.put("quote", "second");
        body.put("startOffset", 50);
        body.put("endOffset", 56);
        body.put("prefix", "p".repeat(250));
        body.put("note", "  " + "n".repeat(1200));
        JsonNode created = postJson("/api/chapters/" + chapter + "/marks", body);
        postJson("/api/chapters/" + chapter + "/marks", Map.of("quote", "first", "startOffset", 10));
        assertThat(fieldNames(created)).containsExactlyInAnyOrder("id", "bookId", "bookTitle", "chapterId", "chapterTitle",
                "chapterOrderIndex", "quote", "prefix", "suffix", "startOffset", "endOffset", "note", "createdAt", "updatedAt");
        assertThat(created.get("prefix").asText()).hasSize(200);
        assertThat(created.get("note").asText()).hasSize(1000).startsWith("n");
        assertThat(created.get("suffix").asText()).isEmpty();

        JsonNode byBook = getJson("/api/books/" + book + "/marks");
        assertThat(byBook).extracting(m -> m.get("quote").asText()).containsExactly("first", "second", "later chapter");
        assertThat(getJson("/api/chapters/" + chapter + "/marks")).hasSize(2);

        long id = created.get("id").asLong();
        JsonNode edited = patchJson("/api/marks/" + id, "{\"note\":\"  short  \"}");
        assertThat(edited.get("note").asText()).isEqualTo("short");
        assertThat(patchJson("/api/marks/" + id, "{\"note\":\"   \"}").get("note").asText()).isEmpty();
        mockMvc.perform(patch("/api/marks/999999").contentType(APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(delete("/api/marks/" + id)).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/marks/" + id)).andExpect(status().isNotFound());
    }

    /** Regression: listing bookmarks / saved passages loaded the chapter (and its explanation) and book per row. */
    @Test
    void historyListsDoNotQueryPerRow() throws Exception {
        long fewBook = postForId("/api/books", Map.of("title", "Few"));
        long fewChapter = postForId("/api/books/" + fewBook + "/chapters", Map.of("title", "F"));
        postForId("/api/chapters/" + fewChapter + "/bookmarks", Map.of());
        postForId("/api/chapters/" + fewChapter + "/marks", Map.of("quote", "q"));
        for (int i = 0; i < 4; i++) {
            long c = postForId("/api/books/" + book + "/chapters", Map.of("title", "M" + i, "orderIndex", i + 10));
            postForId("/api/chapters/" + c + "/bookmarks", Map.of());
            postForId("/api/chapters/" + c + "/marks", Map.of("quote", "q" + i));
        }

        assertThat(statementsFor("/api/bookmarks?bookId=" + book)).isEqualTo(statementsFor("/api/bookmarks?bookId=" + fewBook));
        assertThat(statementsFor("/api/books/" + book + "/marks")).isEqualTo(statementsFor("/api/books/" + fewBook + "/marks"));
    }

    private long statementsFor(String url) throws Exception {
        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        getJson(url);
        return stats.getPrepareStatementCount();
    }

    private void putMissing(String url, String body) throws Exception {
        mockMvc.perform(put(url).contentType(APPLICATION_JSON).content(body)).andExpect(status().isNotFound());
    }

    private JsonNode patchJson(String url, String body) throws Exception {
        return objectMapper.readTree(mockMvc.perform(patch(url).contentType(APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private static JsonNode find(JsonNode list, long id) {
        for (JsonNode n : list) if (n.get("id").asLong() == id) return n;
        return null;
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
