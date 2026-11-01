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
 * writer as the ZIP migration. The library import used to drop chapter excerpts.
 */
class JsonImportApiTest extends IntegrationTest {

    // ---- POST /api/books/import ------------------------------------------------

    /** Regression (BUG-06): excerpts nested in a book's chapters were silently dropped. */
    @Test
    void bookImportKeepsIdeasAndExcerptsOfEveryChapter() throws Exception {
        JsonNode created = postJson("/api/books/import", Map.of("books", List.of(Map.of(
                "title", "Imported", "author", "A",
                "chapters", List.of(Map.of(
                        "title", "C1", "orderIndex", 1, "summary", "S",
                        "keyIdeas", List.of(Map.of("content", "idea", "example", "ex", "orderIndex", 1)),
                        "excerpts", List.of(
                                Map.of("content", "first passage", "note", "why", "source", "p.1", "orderIndex", 1),
                                Map.of("content", "second passage", "orderIndex", 2))))))));

        assertThat(created).hasSize(1);
        assertThat(created.get(0).get("title").asString()).isEqualTo("Imported");
        assertThat(created.get(0).get("chapterCount").asLong()).isEqualTo(1);
        long chapter = getJson("/api/books/" + created.get(0).get("id").asLong() + "/chapters").get(0).get("id").asLong();
        JsonNode excerpts = getJson("/api/chapters/" + chapter + "/excerpts");
        assertThat(excerpts).hasSize(2);
        assertThat(excerpts.get(0).get("content").asString()).isEqualTo("first passage");
        assertThat(excerpts.get(0).get("source").asString()).isEqualTo("p.1");
        assertThat(getJson("/api/chapters/" + chapter + "/ideas").get(0).get("example").asString()).isEqualTo("ex");
    }

    @Test
    void exportedJsonImportsAsAnIdenticalBook() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Round trip", "author", "Me", "structureType", "PARTS",
                "rating", 4, "category", "X;Y", "readingStatus", "READING", "dateAdded", "2020-02-02"));
        long part = postForId("/api/books/" + book + "/parts", Map.of("title", "P1", "orderIndex", 1, "summary", "PS"));
        long chapter = postForId("/api/books/" + book + "/chapters", Map.of("title", "C1", "orderIndex", 1, "partId", part));
        postForId("/api/chapters/" + chapter + "/ideas", Map.of("content", "i", "tags", "t", "highlighted", true, "orderIndex", 1));
        postForId("/api/chapters/" + chapter + "/excerpts", Map.of("content", "e", "note", "n", "highlighted", true, "orderIndex", 1));
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
                                        "title", "C", "excerpts", List.of(Map.of("content", " "))))))))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("books[1].chapters[0].excerpts[0].content: must not be blank"));

        assertThat(getJson("/api/books")).hasSize(before);
    }

    // ---- POST /api/books/{id}/import -------------------------------------------

    @Test
    void structureImportAddsChaptersToAChaptersBook() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Flat"));
        postForId("/api/books/" + book + "/chapters", Map.of("title", "Existing", "orderIndex", 1));

        JsonNode summary = postJson("/api/books/" + book + "/import", Map.of("chapters", List.of(
                Map.of("title", "New", "orderIndex", 2,
                        "keyIdeas", List.of(Map.of("content", "i")),
                        "excerpts", List.of(Map.of("content", "e1"), Map.of("content", "e2"))))));

        assertThat(summary).isEqualTo(objectMapper.valueToTree(Map.of("parts", 0, "chapters", 1, "ideas", 1, "excerpts", 2)));
        assertThat(titles(getJson("/api/books/" + book + "/chapters"))).containsExactly("Existing", "New");
    }

    @Test
    void structureReplaceDeletesThePartsAndChaptersItReplaces() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Replace", "structureType", "PARTS"));
        long oldPart = postForId("/api/books/" + book + "/parts", Map.of("title", "Old part"));
        long inPart = postForId("/api/books/" + book + "/chapters", Map.of("title", "Old in part", "partId", oldPart));
        postForId("/api/chapters/" + inPart + "/excerpts", Map.of("content", "old"));
        postForId("/api/books/" + book + "/chapters", Map.of("title", "Old ungrouped"));

        postJson("/api/books/" + book + "/import", Map.of("mode", "REPLACE", "parts", List.of(
                Map.of("title", "New part", "chapters", List.of(Map.of("title", "New chapter"))))));

        assertThat(titles(getJson("/api/books/" + book + "/parts"))).containsExactly("New part");
        assertThat(titles(getJson("/api/books/" + book + "/chapters"))).containsExactly("New chapter");
        mockMvc.perform(get("/api/chapters/" + inPart + "/excerpts")).andExpect(status().isNotFound());
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
        mockMvc.perform(post("/api/books/987654321/import/content").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"chapters\":[{\"chapter\":\"x\",\"ideas\":[]}]}"))
                .andExpect(status().isNotFound());
        long book = postForId("/api/books", Map.of("title", "Mode"));
        mockMvc.perform(post("/api/books/" + book + "/import").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"MERGE\",\"chapters\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("mode: must be ADD or REPLACE"));
    }

    // ---- POST /api/books/{id}/import/content -----------------------------------

    @Test
    void contentPrefersAnExactTitleOverAnEarlierPartialMatch() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Titles"));
        long ten = postForId("/api/books/" + book + "/chapters", Map.of("title", "Chapter 10", "orderIndex", 1));
        long one = postForId("/api/books/" + book + "/chapters", Map.of("title", "Chapter 1", "orderIndex", 2));
        long three = postForId("/api/books/" + book + "/chapters", Map.of("title", "Chapter 3: Habits", "orderIndex", 3));

        postJson("/api/books/" + book + "/import/content", Map.of("chapters", List.of(
                Map.of("chapter", "chapter 1", "ideas", List.of(Map.of("content", "for one"))),
                Map.of("chapter", "Habits", "excerpts", List.of(Map.of("content", "for three"))))));

        assertThat(getJson("/api/chapters/" + one + "/ideas")).hasSize(1);
        assertThat(getJson("/api/chapters/" + ten + "/ideas")).isEmpty();
        assertThat(getJson("/api/chapters/" + three + "/excerpts").get(0).get("content").asString()).isEqualTo("for three");
    }

    @Test
    void contentReplaceClearsOnlyTheNamedKindOncePerChapter() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Replace content"));
        long chapter = postForId("/api/books/" + book + "/chapters", Map.of("title", "C"));
        long other = postForId("/api/books/" + book + "/chapters", Map.of("title", "Other"));
        postForId("/api/chapters/" + chapter + "/ideas", Map.of("content", "old idea"));
        postForId("/api/chapters/" + chapter + "/excerpts", Map.of("content", "kept excerpt"));
        postForId("/api/chapters/" + other + "/ideas", Map.of("content", "other idea"));

        JsonNode summary = postJson("/api/books/" + book + "/import/content", Map.of("mode", "REPLACE", "chapters", List.of(
                Map.of("chapterId", chapter, "ideas", List.of(Map.of("content", "new 1"))),
                Map.of("chapter", "C", "ideas", List.of(Map.of("content", "new 2"))))));

        assertThat(summary.get("ideas").asInt()).isEqualTo(2);
        assertThat(contents(getJson("/api/chapters/" + chapter + "/ideas"))).containsExactlyInAnyOrder("new 1", "new 2");
        assertThat(contents(getJson("/api/chapters/" + chapter + "/excerpts"))).containsExactly("kept excerpt");
        assertThat(contents(getJson("/api/chapters/" + other + "/ideas"))).containsExactly("other idea");
    }

    @Test
    void contentForAnUnknownChapterImportsNothing() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Unknown chapter"));
        long chapter = postForId("/api/books/" + book + "/chapters", Map.of("title", "Known"));
        long foreign = postForId("/api/books/" + postForId("/api/books", Map.of("title", "Foreign")) + "/chapters",
                Map.of("title", "Elsewhere"));

        mockMvc.perform(post("/api/books/" + book + "/import/content").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("chapters", List.of(
                                Map.of("chapter", "Known", "ideas", List.of(Map.of("content", "i"))),
                                Map.of("chapter", "Missing", "ideas", List.of(Map.of("content", "j"))))))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Chapter not found: \"Missing\". Make sure the chapter title matches."));
        mockMvc.perform(post("/api/books/" + book + "/import/content").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("chapters", List.of(
                                Map.of("chapterId", foreign, "ideas", List.of(Map.of("content", "i"))))))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/books/" + book + "/import/content").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"chapters\":[{\"chapter\":\"Known\"}]}"))
                .andExpect(status().isBadRequest());

        assertThat(getJson("/api/chapters/" + chapter + "/ideas")).isEmpty();
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

    private static List<String> contents(JsonNode list) {
        List<String> contents = new ArrayList<>();
        list.forEach(node -> contents.add(node.get("content").asString()));
        return contents;
    }

    private JsonNode getJson(String url) throws Exception {
        return objectMapper.readTree(mockMvc.perform(get(url))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
}
