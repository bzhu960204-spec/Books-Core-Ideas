package com.bookscoreideas.books;

import com.bookscoreideas.support.IntegrationTest;
import tools.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FE-08 / BUG-06: JSON import on the server, one transaction per request, the same
 * writer as the ZIP migration.
 */
class JsonImportApiTest extends IntegrationTest {

    // ---- POST /api/books/import ------------------------------------------------

    /** JSON written for the removed key ideas / excerpts features still imports; that content is ignored. */
    @Test
    void bookImportCreatesChaptersAndIgnoresKeyIdeasAndExcerpts() throws Exception {
        JsonNode created = postJson("/api/books/import", Map.of("books", List.of(Map.of(
                "title", "Imported", "author", "A",
                "chapters", List.of(Map.of(
                        "title", "C1", "orderIndex", 1, "summary", "S",
                        "keyIdeas", List.of(Map.of("content", "idea")),
                        "excerpts", List.of(Map.of("content", "passage"))))))));

        assertThat(created).hasSize(1);
        assertThat(created.get(0).get("title").asString()).isEqualTo("Imported");
        assertThat(created.get(0).get("chapterCount").asLong()).isEqualTo(1);
        JsonNode chapter = getJson("/api/books/" + created.get(0).get("id").asLong() + "/chapters").get(0);
        assertThat(chapter.get("summary").asString()).isEqualTo("S");
        assertThat(chapter.has("keyIdeas")).isFalse();
    }

    @Test
    void exportedJsonImportsAsAnIdenticalBook() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Round trip", "author", "Me", "structureType", "PARTS",
                "rating", 4, "category", "X;Y", "readingStatus", "READING", "dateAdded", "2020-02-02"));
        long part = postForId("/api/books/" + book + "/parts", Map.of("title", "P1", "orderIndex", 1, "summary", "PS"));
        postForId("/api/books/" + book + "/chapters", Map.of("title", "C1", "orderIndex", 1, "summary", "S", "partId", part));
        postForId("/api/books/" + book + "/parts", Map.of("title", "Empty part", "orderIndex", 2));
        JsonNode export = getJson("/api/books/" + book + "/export");

        JsonNode created = postJson("/api/books/import", Map.of("books", List.of(export)));

        assertThat(getJson("/api/books/" + created.get(0).get("id").asLong() + "/export")).isEqualTo(export);
    }

    @Test
    void partsBookTakesPartsAndUngroupedChapters() throws Exception {
        JsonNode created = postJson("/api/books/import", Map.of("books", List.of(Map.of(
                "title", "With parts",
                "parts", List.of(Map.of("title", "P1", "chapters", List.of(Map.of("title", "In part")))),
                "chapters", List.of(Map.of("title", "Ungrouped"))))));

        long book = created.get(0).get("id").asLong();
        assertThat(created.get(0).get("structureType").asString()).isEqualTo("PARTS");
        JsonNode chapters = getJson("/api/books/" + book + "/chapters");
        assertThat(chapters).hasSize(2);
        long partId = getJson("/api/books/" + book + "/parts").get(0).get("id").asLong();
        assertThat(byTitle(chapters, "In part").get("partId").asLong()).isEqualTo(partId);
        assertThat(byTitle(chapters, "Ungrouped").get("partId").isNull()).isTrue();
    }

    @Test
    void anInvalidBookImportsNothingAndNamesTheField() throws Exception {
        int before = getJson("/api/books").size();

        mockMvc.perform(post("/api/books/import").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("books", List.of(
                                Map.of("title", "Valid one"),
                                Map.of("title", "Broken", "chapters", List.of(Map.of(
                                        "title", " "))))))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("books[1].chapters[0].title: must not be blank"));

        assertThat(getJson("/api/books")).hasSize(before);
    }

    // ---- POST /api/books/{id}/import -------------------------------------------

    @Test
    void structureImportAddsChaptersToAChaptersBook() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Flat"));
        postForId("/api/books/" + book + "/chapters", Map.of("title", "Existing", "orderIndex", 1));

        JsonNode summary = postJson("/api/books/" + book + "/import", Map.of("chapters", List.of(
                Map.of("title", "New", "orderIndex", 2))));

        assertThat(summary).isEqualTo(objectMapper.valueToTree(Map.of("parts", 0, "chapters", 1)));
        assertThat(titles(getJson("/api/books/" + book + "/chapters"))).containsExactly("Existing", "New");
    }

    @Test
    void structureReplaceDeletesThePartsAndChaptersItReplaces() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Replace", "structureType", "PARTS"));
        long oldPart = postForId("/api/books/" + book + "/parts", Map.of("title", "Old part"));
        long inPart = postForId("/api/books/" + book + "/chapters", Map.of("title", "Old in part", "partId", oldPart));
        putJson("/api/chapters/" + inPart + "/explanation", Map.of("content", "<p>old</p>"));
        postForId("/api/books/" + book + "/chapters", Map.of("title", "Old ungrouped"));

        postJson("/api/books/" + book + "/import", Map.of("mode", "REPLACE", "parts", List.of(
                Map.of("title", "New part", "chapters", List.of(Map.of("title", "New chapter"))))));

        assertThat(titles(getJson("/api/books/" + book + "/parts"))).containsExactly("New part");
        assertThat(titles(getJson("/api/books/" + book + "/chapters"))).containsExactly("New chapter");
        mockMvc.perform(get("/api/chapters/" + inPart + "/explanation")).andExpect(status().isNotFound());
    }

    @Test
    void partsCannotBeImportedIntoAChaptersBook() throws Exception {
        long book = postForId("/api/books", Map.of("title", "No parts"));

        mockMvc.perform(post("/api/books/" + book + "/import").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"parts\":[{\"title\":\"P\"}]}"))
                .andExpect(status().isBadRequest());
        assertThat(getJson("/api/books/" + book + "/parts")).isEmpty();
    }

    @Test
    void importIntoAMissingBookIs404AndAnUnknownModeIs400() throws Exception {
        mockMvc.perform(post("/api/books/987654321/import").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"chapters\":[]}"))
                .andExpect(status().isNotFound());
        long book = postForId("/api/books", Map.of("title", "Mode"));
        mockMvc.perform(post("/api/books/" + book + "/import").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"MERGE\",\"chapters\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("mode: must be ADD or REPLACE"));
    }

    private static JsonNode byTitle(JsonNode list, String title) {
        for (JsonNode node : list) if (node.get("title").asString().equals(title)) return node;
        throw new AssertionError("no " + title);
    }

    private static List<String> titles(JsonNode list) {
        List<String> titles = new ArrayList<>();
        list.forEach(node -> titles.add(node.get("title").asString()));
        return titles;
    }

    private JsonNode getJson(String url) throws Exception {
        return objectMapper.readTree(mockMvc.perform(get(url))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
}
