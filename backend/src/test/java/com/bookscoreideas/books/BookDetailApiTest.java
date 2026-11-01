package com.bookscoreideas.books;

import com.bookscoreideas.support.IntegrationTest;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FE-03: GET /api/books/{id}/detail returns what the book page used to fetch with
 * one request per chapter, in a number of queries that does not grow with the book.
 */
class BookDetailApiTest extends IntegrationTest {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1};

    @Autowired private EntityManagerFactory entityManagerFactory;

    @Test
    void detailMatchesTheSeparateEndpoints() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Detail", "structureType", "PARTS",
                "chapterImagesEnabled", true));
        long part = postForId("/api/books/" + book + "/parts", Map.of("title", "P1", "orderIndex", 1));
        long first = postForId("/api/books/" + book + "/chapters", Map.of("title", "One", "orderIndex", 1, "partId", part));
        long second = postForId("/api/books/" + book + "/chapters", Map.of("title", "Two", "orderIndex", 2));
        postForId("/api/chapters/" + first + "/ideas", Map.of("content", "idea"));
        postForId("/api/chapters/" + first + "/excerpts", Map.of("content", "later", "orderIndex", 2));
        postForId("/api/chapters/" + first + "/excerpts", Map.of("content", "earlier", "orderIndex", 1, "note", "n"));
        postForId("/api/chapters/" + second + "/excerpts", Map.of("content", "other"));
        uploadImage(second);
        uploadImage(second);
        putJson("/api/chapters/" + first + "/explanation", Map.of("content", "<p>text</p>"));
        postForId("/api/chapters/" + first + "/bookmarks", Map.of("scrollRatio", 0.2));
        postForId("/api/chapters/" + second + "/bookmarks", Map.of("scrollRatio", 0.7));
        postForId("/api/chapters/" + first + "/marks", Map.of("quote", "text"));

        JsonNode detail = getJson("/api/books/" + book + "/detail");

        assertThat(fieldNames(detail)).containsExactly("book", "parts", "chapters", "bookmarks", "marks");
        assertThat(detail.get("book")).isEqualTo(getJson("/api/books/" + book));
        assertThat(detail.get("parts")).isEqualTo(getJson("/api/books/" + book + "/parts"));
        assertThat(detail.get("bookmarks")).isEqualTo(getJson("/api/bookmarks?bookId=" + book));
        assertThat(detail.get("marks")).isEqualTo(getJson("/api/books/" + book + "/marks"));

        JsonNode chapters = getJson("/api/books/" + book + "/chapters");
        List<Long> explained = new ArrayList<>();
        getJson("/api/books/" + book + "/explanation-chapter-ids").forEach(id -> explained.add(id.asLong()));
        ArrayNode expected = objectMapper.createArrayNode();
        for (JsonNode chapter : chapters) {
            long id = chapter.get("id").asLong();
            ObjectNode c = (ObjectNode) chapter.deepCopy();
            c.set("excerpts", getJson("/api/chapters/" + id + "/excerpts"));
            c.put("imageCount", getJson("/api/chapters/" + id + "/images").size());
            c.put("hasExplanation", explained.contains(id));
            expected.add(c);
        }
        assertThat(detail.get("chapters")).isEqualTo(expected);

        JsonNode one = detail.get("chapters").get(0);
        assertThat(one.get("excerpts").get(0).get("content").asString()).isEqualTo("earlier");
        assertThat(one.get("hasExplanation").asBoolean()).isTrue();
        assertThat(detail.get("chapters").get(1).get("imageCount").asLong()).isEqualTo(2);
    }

    @Test
    void emptyBookHasEmptyLists() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Empty"));

        JsonNode detail = getJson("/api/books/" + book + "/detail");

        assertThat(detail.get("book").get("chapterCount").asLong()).isZero();
        for (String list : new String[]{"parts", "chapters", "bookmarks", "marks"}) {
            assertThat(detail.get(list)).isEmpty();
        }
    }

    @Test
    void unknownBookIs404() throws Exception {
        mockMvc.perform(get("/api/books/987654321/detail"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    /** Regression (FE-03): the page made 2 requests per chapter (excerpts, images). */
    @Test
    void queryCountDoesNotGrowWithChapters() throws Exception {
        long small = fullBook(1);
        long large = fullBook(6);

        assertThat(statementsFor("/api/books/" + large + "/detail"))
                .isEqualTo(statementsFor("/api/books/" + small + "/detail"));
    }

    private long fullBook(int chapters) throws Exception {
        long book = postForId("/api/books", Map.of("title", "Full" + chapters, "structureType", "PARTS"));
        long part = postForId("/api/books/" + book + "/parts", Map.of("title", "P"));
        for (int i = 1; i <= chapters; i++) {
            long chapter = postForId("/api/books/" + book + "/chapters", Map.of("title", "c" + i, "orderIndex", i, "partId", part));
            postForId("/api/chapters/" + chapter + "/ideas", Map.of("content", "i" + i));
            postForId("/api/chapters/" + chapter + "/excerpts", Map.of("content", "e" + i));
            uploadImage(chapter);
            putJson("/api/chapters/" + chapter + "/explanation", Map.of("content", "<p>x" + i + "</p>"));
            postForId("/api/chapters/" + chapter + "/bookmarks", Map.of("scrollRatio", 0.5));
            postForId("/api/chapters/" + chapter + "/marks", Map.of("quote", "x" + i));
        }
        return book;
    }

    private void uploadImage(long chapter) throws Exception {
        mockMvc.perform(multipart("/api/chapters/" + chapter + "/images")
                        .file(new MockMultipartFile("files", "a.png", "image/png", PNG)))
                .andExpect(status().isCreated());
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
