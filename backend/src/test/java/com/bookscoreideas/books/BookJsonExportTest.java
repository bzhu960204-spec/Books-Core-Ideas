package com.bookscoreideas.books;

import com.bookscoreideas.support.IntegrationTest;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Characterisation of the single-book JSON export ("Export JSON" button). Its shape
 * is the documented JSON import format, so it must stay exactly as it is (key order
 * included) when it shares the archive builder with the ZIP migration (BE-06/BE-08).
 */
class BookJsonExportTest extends IntegrationTest {

    @Test
    void partsBookExportsTheImportFormat() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Parts JSON", "author", "A", "isbn", "123",
                "description", "d", "category", "c1;c2", "rating", 4, "readingStatus", "READING",
                "structureType", "PARTS", "coverUrl", "http://x/c.png"));
        long part = postForId("/api/books/" + book + "/parts", Map.of("title", "P1", "orderIndex", 1, "summary", "ps"));
        long chapter = postForId("/api/books/" + book + "/chapters",
                Map.of("title", "C1", "orderIndex", 1, "summary", "<p>s</p>", "partId", part));
        postForId("/api/chapters/" + chapter + "/ideas",
                Map.of("content", "idea", "example", "ex", "tags", "t1", "highlighted", true, "orderIndex", 1));
        postForId("/api/chapters/" + chapter + "/excerpts",
                Map.of("content", "quote", "note", "n", "source", "p.1", "orderIndex", 1));
        putJson("/api/chapters/" + chapter + "/explanation", Map.of("content", "<p>not in this format</p>"));
        postForId("/api/books/" + book + "/reviews", Map.of("title", "r", "content", "not in this format"));

        assertThat(export(book)).isEqualTo("{\"title\":\"Parts JSON\",\"author\":\"A\",\"isbn\":\"123\",\"description\":\"d\","
                + "\"category\":\"c1;c2\",\"rating\":4,\"readingStatus\":\"READING\",\"dateAdded\":\"" + LocalDate.now() + "\","
                + "\"structureType\":\"PARTS\",\"parts\":[{\"title\":\"P1\",\"orderIndex\":1,\"summary\":\"ps\",\"chapters\":["
                + "{\"title\":\"C1\",\"orderIndex\":1,\"summary\":\"<p>s</p>\","
                + "\"keyIdeas\":[{\"content\":\"idea\",\"example\":\"ex\",\"tags\":\"t1\",\"highlighted\":true,\"orderIndex\":1}],"
                + "\"excerpts\":[{\"content\":\"quote\",\"note\":\"n\",\"source\":\"p.1\",\"highlighted\":false,\"orderIndex\":1}]}]}]}");
    }

    @Test
    void chaptersBookExportsTheImportFormat() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Flat JSON"));
        postForId("/api/books/" + book + "/chapters", Map.of("title", "Only", "orderIndex", 1));

        assertThat(export(book)).isEqualTo("{\"title\":\"Flat JSON\",\"author\":null,\"isbn\":null,\"description\":null,"
                + "\"category\":null,\"rating\":null,\"readingStatus\":null,\"dateAdded\":\"" + LocalDate.now() + "\","
                + "\"structureType\":\"CHAPTERS\",\"chapters\":[{\"title\":\"Only\",\"orderIndex\":1,\"summary\":null,"
                + "\"keyIdeas\":[],\"excerpts\":[]}]}");
    }

    /** Regression (BUG-14): a PARTS book's chapters outside any part were left out of the export. */
    @Test
    void ungroupedChaptersOfAPartsBookFollowItsParts() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Loose JSON", "structureType", "PARTS"));
        long part = postForId("/api/books/" + book + "/parts", Map.of("title", "P1", "orderIndex", 1));
        postForId("/api/books/" + book + "/chapters", Map.of("title", "In part", "orderIndex", 1, "partId", part));
        long loose = postForId("/api/books/" + book + "/chapters", Map.of("title", "Loose", "orderIndex", 2));
        postForId("/api/chapters/" + loose + "/excerpts", Map.of("content", "kept", "orderIndex", 1));

        assertThat(export(book)).endsWith("\"structureType\":\"PARTS\",\"parts\":[{\"title\":\"P1\",\"orderIndex\":1,"
                + "\"summary\":null,\"chapters\":[{\"title\":\"In part\",\"orderIndex\":1,\"summary\":null,"
                + "\"keyIdeas\":[],\"excerpts\":[]}]}],"
                + "\"chapters\":[{\"title\":\"Loose\",\"orderIndex\":2,\"summary\":null,\"keyIdeas\":[],"
                + "\"excerpts\":[{\"content\":\"kept\",\"note\":null,\"source\":null,\"highlighted\":false,\"orderIndex\":1}]}]}");
    }

    @Test
    void missingBookIs404() throws Exception {
        mockMvc.perform(get("/api/books/987654321/export")).andExpect(status().isNotFound());
    }

    private String export(long book) throws Exception {
        return mockMvc.perform(get("/api/books/" + book + "/export"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }
}
