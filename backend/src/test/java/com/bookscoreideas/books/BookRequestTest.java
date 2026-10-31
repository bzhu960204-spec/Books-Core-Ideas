package com.bookscoreideas.books;

import com.bookscoreideas.support.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Request side of the /api/books contract (BE-02). */
class BookRequestTest extends IntegrationTest {

    /** Regression for BUG-09: a client-supplied id used to turn POST into a merge and fail with 500. */
    @Test
    void createIgnoresClientSuppliedIdAndNestedChapters() throws Exception {
        long existing = postForId("/api/books", Map.of("title", "Keep me"));

        JsonNode created = postJson("/api/books", Map.of(
                "id", existing,
                "title", "Brand new",
                "chapters", List.of(Map.of("title", "Smuggled chapter"))));

        long newId = created.get("id").asLong();
        assertThat(newId).isNotEqualTo(existing);
        mockMvc.perform(get("/api/books/" + existing))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Keep me"));
        mockMvc.perform(get("/api/books/" + newId + "/chapters"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    /** The library's JSON import posts exported fields such as dateAdded; they must still be stored. */
    @Test
    void createStoresEveryEditableField() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("title", "Imported");
        body.put("author", "Author");
        body.put("isbn", "978-0");
        body.put("description", "Desc");
        body.put("coverUrl", "https://example.com/c.png");
        body.put("dateAdded", "2020-01-02");
        body.put("rating", 4);
        body.put("category", "A;B");
        body.put("readingStatus", "FINISHED");
        body.put("startDate", "2020-02-01");
        body.put("finishDate", "2020-03-01");
        body.put("chapterImagesEnabled", true);
        body.put("structureType", "PARTS");

        long id = postForId("/api/books", body);

        JsonNode book = getJson("/api/books/" + id);
        body.forEach((field, value) -> assertThat(book.get(field).asText())
                .as(field).isEqualTo(String.valueOf(value)));
    }

    @Test
    void createDefaultsDateAddedAndStructure() throws Exception {
        JsonNode book = postJson("/api/books", Map.of("title", "Defaults"));

        assertThat(book.get("dateAdded").isNull()).isFalse();
        assertThat(book.get("structureType").asText()).isEqualTo("CHAPTERS");
        assertThat(book.get("chapterImagesEnabled").asBoolean()).isFalse();
    }

    @Test
    void updateReplacesEditableFieldsButKeepsDateAddedAndStructure() throws Exception {
        long id = postForId("/api/books", Map.of(
                "title", "Before", "dateAdded", "2019-05-05", "structureType", "PARTS", "rating", 2,
                "chapterImagesEnabled", true));

        Map<String, Object> update = new HashMap<>();
        update.put("title", "After");
        update.put("rating", 5);
        update.put("dateAdded", "2000-01-01");
        update.put("structureType", null);
        JsonNode updated = putJson("/api/books/" + id, update);

        assertThat(updated.get("title").asText()).isEqualTo("After");
        assertThat(updated.get("rating").asInt()).isEqualTo(5);
        assertThat(updated.get("dateAdded").asText()).isEqualTo("2019-05-05");
        assertThat(updated.get("structureType").asText()).isEqualTo("PARTS");
        assertThat(updated.get("author").isNull()).isTrue();
        // Omitted flag means "off", as when the request was bound to the entity's default.
        assertThat(updated.get("chapterImagesEnabled").isBoolean()).isTrue();
        assertThat(updated.get("chapterImagesEnabled").asBoolean()).isFalse();
    }

    @Test
    void blankTitleIsRejectedWithFieldDetail() throws Exception {
        mockMvc.perform(post("/api/books").contentType(APPLICATION_JSON).content("{\"title\":\" \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("title: must not be blank"));

        long id = postForId("/api/books", Map.of("title", "Valid"));
        mockMvc.perform(put("/api/books/" + id).contentType(APPLICATION_JSON).content("{\"title\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("title: must not be blank"));
    }

    private JsonNode getJson(String url) throws Exception {
        return objectMapper.readTree(mockMvc.perform(get(url))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
}
