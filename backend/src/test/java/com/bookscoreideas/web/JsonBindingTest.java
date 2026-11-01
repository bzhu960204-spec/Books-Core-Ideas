package com.bookscoreideas.web;

import com.bookscoreideas.support.IntegrationTest;
import tools.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * How request and response JSON is bound, independent of the Jackson version (BE-10:
 * Spring Boot 4 moves to Jackson 3, whose defaults differ from Jackson 2's). Clients and
 * exported files written against the current behavior must keep working.
 */
class JsonBindingTest extends IntegrationTest {

    @Test
    void anExplicitNullForAFlagMeansFalse() throws Exception {
        long chapter = newChapter();

        JsonNode idea = send("/api/chapters/" + chapter + "/ideas", "{\"content\":\"i\",\"highlighted\":null}");
        JsonNode excerpt = send("/api/chapters/" + chapter + "/excerpts", "{\"content\":\"e\",\"highlighted\":null}");

        assertThat(idea.get("highlighted").asBoolean(true)).isFalse();
        assertThat(excerpt.get("highlighted").asBoolean(true)).isFalse();
    }

    @Test
    void unknownFieldsAreIgnored() throws Exception {
        long chapter = newChapter();

        JsonNode idea = send("/api/chapters/" + chapter + "/ideas", "{\"content\":\"i\",\"color\":\"red\",\"likes\":3}");

        assertThat(idea.get("content").asString()).isEqualTo("i");
        assertThat(idea.has("color")).isFalse();
    }

    // Changed on purpose with Jackson 3 (BE-10): Jackson 2 read the first value and ignored
    // whatever followed it, so a truncated or concatenated body could be half-applied.
    @Test
    void contentAfterTheBodyIsA400() throws Exception {
        long chapter = newChapter();

        MockHttpServletResponse response = mockMvc.perform(post("/api/chapters/" + chapter + "/ideas")
                        .contentType(APPLICATION_JSON).content("{\"content\":\"i\"} {\"content\":\"j\"}"))
                .andReturn().getResponse();

        assertThat(response.getStatus()).isEqualTo(400);
        assertThat(objectMapper.readTree(response.getContentAsString()).get("detail").asString())
                .isEqualTo("Failed to read request");
    }

    @Test
    void responseFieldsKeepTheirDeclaredOrderAndDatesAreIsoStrings() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Order", "dateAdded", "2026-01-02", "startDate", "2026-02-03"));

        JsonNode dto = getJson("/api/books/" + book);

        assertThat(fieldNames(dto)).containsExactly("id", "title", "author", "isbn", "description", "coverUrl",
                "dateAdded", "rating", "category", "readingStatus", "startDate", "finishDate",
                "chapterImagesEnabled", "structureType", "chapterCount");
        assertThat(dto.get("dateAdded").isString()).isTrue();
        assertThat(dto.get("dateAdded").asString()).isEqualTo("2026-01-02");
        assertThat(dto.get("startDate").asString()).isEqualTo("2026-02-03");
        assertThat(dto.get("finishDate").isNull()).isTrue();
    }

    @Test
    void problemDetailsKeepTheirFieldOrder() throws Exception {
        MockHttpServletResponse response = mockMvc.perform(get("/api/books/999999999")).andReturn().getResponse();

        assertThat(response.getStatus()).isEqualTo(404);
        JsonNode problem = objectMapper.readTree(response.getContentAsString());
        // Spring 7 leaves out the default type, which RFC 9457 defines as meaning "about:blank".
        if (problem.has("type")) assertThat(problem.get("type").asString()).isEqualTo("about:blank");
        assertThat(fieldNames(problem)).filteredOn(name -> !name.equals("type"))
                .containsExactly("title", "status", "detail", "instance");
    }

    private long newChapter() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Binding " + System.nanoTime()));
        return postForId("/api/books/" + book + "/chapters", Map.of("title", "Ch"));
    }

    private JsonNode send(String url, String json) throws Exception {
        MockHttpServletResponse response = mockMvc.perform(post(url).contentType(APPLICATION_JSON).content(json))
                .andReturn().getResponse();
        assertThat(response.getStatus()).as(response.getContentAsString()).isEqualTo(201);
        return objectMapper.readTree(response.getContentAsString());
    }

    private JsonNode getJson(String url) throws Exception {
        return objectMapper.readTree(mockMvc.perform(get(url)).andReturn().getResponse().getContentAsString());
    }

    private static List<String> fieldNames(JsonNode node) {
        List<String> names = new ArrayList<>();
        node.propertyNames().forEach(names::add);
        return names;
    }
}
