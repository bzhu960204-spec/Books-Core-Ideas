package com.bookscoreideas.migration;

import com.bookscoreideas.support.IntegrationTest;
import tools.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * BE-08: the migration archive (format v2) carries everything a book owns, so an
 * export can restore the book completely: reviews, reading bookmarks, saved
 * passages (marks), collection memberships, and the original timestamps. Older
 * (v1) archives still import; archives from a newer format are refused.
 */
class MigrationArchiveTest extends IntegrationTest {

    @Autowired private JdbcTemplate jdbc;

    @Test
    void exportImportRoundTripRestoresEverythingTheBookOwns() throws Exception {
        String suffix = Long.toString(System.nanoTime());
        String title = "Archive v2 " + suffix;
        long book = postForId("/api/books", Map.of("title", title, "author", "Author", "structureType", "PARTS"));
        long part = postForId("/api/books/" + book + "/parts", Map.of("title", "P1", "orderIndex", 1));
        long ch1 = postForId("/api/books/" + book + "/chapters", Map.of("title", "C1", "orderIndex", 1, "partId", part));
        long ch2 = postForId("/api/books/" + book + "/chapters", Map.of("title", "C2", "orderIndex", 2, "partId", part));
        postForId("/api/chapters/" + ch1 + "/ideas", Map.of("content", "idea", "tags", "t", "highlighted", true));
        postForId("/api/chapters/" + ch1 + "/excerpts", Map.of("content", "quote", "note", "n"));
        putJson("/api/chapters/" + ch1 + "/explanation", Map.of("content", "<p>Alpha beta gamma</p>"));
        postForId("/api/chapters/" + ch1 + "/marks", Map.of("quote", "beta", "prefix", "Alpha ", "suffix", " gamma",
                "startOffset", 6, "endOffset", 10, "note", "remember"));
        postForId("/api/chapters/" + ch1 + "/bookmarks", Map.of("scrollRatio", 0.3, "note", "first"));
        postForId("/api/chapters/" + ch2 + "/bookmarks", Map.of("scrollRatio", 0.8, "note", "second"));
        postForId("/api/books/" + book + "/reviews", Map.of("title", "Verdict", "content", "<p>good</p>"));
        String shelf = "Shelf " + suffix;
        String other = "Other " + suffix;
        long root = postForId("/api/book-collections", Map.of("name", shelf));
        long child = postForId("/api/book-collections", Map.of("name", "Child", "parentId", root));
        long otherRoot = postForId("/api/book-collections", Map.of("name", other));
        addToCollection(child, book);
        addToCollection(otherRoot, book);
        // Timestamps the API would set to "now"; the archive must keep the originals.
        jdbc.update("UPDATE BOOK_REVIEWS SET UPDATED_AT = DATE '2020-01-02' WHERE BOOK_ID = ?", book);
        jdbc.update("UPDATE CHAPTER_EXPLANATIONS SET UPDATED_AT = DATE '2020-02-03' WHERE CHAPTER_ID = ?", ch1);
        jdbc.update("UPDATE READING_BOOKMARKS SET CREATED_AT = TIMESTAMP '2020-03-04 05:06:07' WHERE CHAPTER_ID = ?", ch1);
        jdbc.update("UPDATE EXPLANATION_MARKS SET CREATED_AT = TIMESTAMP '2020-04-05 06:07:08', "
                + "UPDATED_AT = TIMESTAMP '2020-04-06 06:07:08' WHERE CHAPTER_ID = ?", ch1);

        Map<String, byte[]> original = unzip(export(book));
        JsonNode manifest = objectMapper.readTree(original.get("manifest.json"));
        assertThat(manifest.get("formatVersion").asInt()).isEqualTo(2);
        JsonNode exported = objectMapper.readTree(original.get(manifest.get("books").get(0).get("path").asString()));
        assertThat(exported.get("reviews")).hasSize(1);
        assertThat(exported.get("reviews").get(0).get("updatedAt").asString()).isEqualTo("2020-01-02");
        JsonNode exportedCh1 = exported.get("parts").get(0).get("chapters").get(0);
        assertThat(exportedCh1.get("explanation").get("updatedAt").asString()).isEqualTo("2020-02-03");
        assertThat(exportedCh1.get("bookmarks")).hasSize(1);
        assertThat(exportedCh1.get("marks")).hasSize(1);
        assertThat(exported.get("parts").get(0).get("chapters").get(1).get("bookmarks")).hasSize(1);
        assertThat(paths(exported)).containsExactlyInAnyOrder(List.of(shelf, "Child"), List.of(other));

        mockMvc.perform(delete("/api/books/" + book)).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/book-collections/" + child)).andExpect(status().isNoContent());

        JsonNode result = importArchive(zip(original));
        assertThat(result.get("booksImported").asInt()).isEqualTo(1);
        long imported = bookIdByTitle(title);

        Map<String, byte[]> again = unzip(export(imported));
        JsonNode reexported = objectMapper.readTree(again.get(objectMapper.readTree(again.get("manifest.json"))
                .get("books").get(0).get("path").asString()));
        assertThat(reexported).isEqualTo(exported);

        JsonNode history = getJson("/api/bookmarks?bookId=" + imported);
        assertThat(history).extracting(b -> b.get("note").asString()).containsExactly("second", "first");
        assertThat(history.get(1).get("createdAt").asString()).startsWith("2020-03-04T05:06:07");
        JsonNode marks = getJson("/api/books/" + imported + "/marks");
        assertThat(marks.get(0).get("quote").asString()).isEqualTo("beta");
        assertThat(marks.get(0).get("startOffset").asInt()).isEqualTo(6);
        assertThat(marks.get(0).get("bookId").asLong()).isEqualTo(imported);
        JsonNode folders = getJson("/api/book-collections");
        assertThat(folders).filteredOn(f -> f.get("name").asString().equals(shelf)).hasSize(1);
        assertThat(folders).filteredOn(f -> f.get("name").asString().equals("Child")
                && f.get("parentId").asLong() == root).hasSize(1);
    }

    @Test
    void previewCountsWhatTheArchiveCarries() throws Exception {
        String title = "Preview v2 " + System.nanoTime();
        long book = postForId("/api/books", Map.of("title", title));
        long chapter = postForId("/api/books/" + book + "/chapters", Map.of("title", "C"));
        postForId("/api/chapters/" + chapter + "/bookmarks", Map.of("scrollRatio", 0.5));
        postForId("/api/chapters/" + chapter + "/marks", Map.of("quote", "q"));
        postForId("/api/books/" + book + "/reviews", Map.of("title", "r", "content", "c"));
        addToCollection(postForId("/api/book-collections", Map.of("name", "Preview " + book)), book);

        JsonNode preview = objectMapper.readTree(mockMvc.perform(multipart("/api/migration/import/preview")
                        .file(new MockMultipartFile("file", "a.zip", "application/zip", export(book))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());

        assertThat(preview.get("formatVersion").asInt()).isEqualTo(2);
        JsonNode entry = preview.get("books").get(0);
        assertThat(entry.get("conflict").asBoolean()).isTrue();
        assertThat(entry.get("reviewCount").asInt()).isEqualTo(1);
        assertThat(entry.get("bookmarkCount").asInt()).isEqualTo(1);
        assertThat(entry.get("markCount").asInt()).isEqualTo(1);
        assertThat(entry.get("collectionCount").asInt()).isEqualTo(1);
    }

    /** v1 archives (before BE-08) keep importing; their explanation dates are no longer dropped. */
    @Test
    void version1ArchiveStillImports() throws Exception {
        String title = "Legacy archive " + System.nanoTime();
        byte[] zip = archive(1, title, """
                {"formatVersion":1,"title":"%s","author":"Old","structureType":"CHAPTERS","chapterImagesEnabled":false,
                 "chapters":[{"title":"C","orderIndex":1,"summary":"s",
                   "explanation":{"content":"<p>e</p>","updatedAt":"2021-05-06"},
                   "keyIdeas":[{"content":"i","highlighted":false,"orderIndex":1}],"excerpts":[],"images":[]}]}
                """.formatted(title));

        JsonNode result = importArchive(zip);

        assertThat(result.get("booksImported").asInt()).isEqualTo(1);
        long book = bookIdByTitle(title);
        JsonNode chapters = getJson("/api/books/" + book + "/chapters");
        assertThat(chapters).hasSize(1);
        assertThat(chapters.get(0).get("keyIdeas")).hasSize(1);
        JsonNode explanation = getJson("/api/chapters/" + chapters.get(0).get("id").asLong() + "/explanation");
        assertThat(explanation.get("content").asString()).isEqualTo("<p>e</p>");
        assertThat(explanation.get("updatedAt").asString()).isEqualTo("2021-05-06");
        assertThat(getJson("/api/books/" + book + "/reviews")).isEmpty();
    }

    /** Regression (BUG-14): a PARTS book's chapters outside any part were left out of the archive. */
    @Test
    void ungroupedChaptersOfAPartsBookSurviveTheArchive() throws Exception {
        String title = "Ungrouped " + System.nanoTime();
        long book = postForId("/api/books", Map.of("title", title, "structureType", "PARTS"));
        long part = postForId("/api/books/" + book + "/parts", Map.of("title", "P1"));
        postForId("/api/books/" + book + "/chapters", Map.of("title", "Grouped", "orderIndex", 1, "partId", part));
        long loose = postForId("/api/books/" + book + "/chapters", Map.of("title", "Loose", "orderIndex", 2));
        postForId("/api/chapters/" + loose + "/excerpts", Map.of("content", "kept"));
        byte[] zip = export(book);
        mockMvc.perform(delete("/api/books/" + book)).andExpect(status().isNoContent());

        assertThat(importArchive(zip).get("booksImported").asInt()).isEqualTo(1);

        long imported = bookIdByTitle(title);
        JsonNode chapters = getJson("/api/books/" + imported + "/chapters");
        assertThat(chapters).hasSize(2);
        JsonNode looseCopy = chapters.get(1);
        assertThat(looseCopy.get("title").asString()).isEqualTo("Loose");
        assertThat(looseCopy.get("partId").isNull()).isTrue();
        assertThat(getJson("/api/chapters/" + looseCopy.get("id").asLong() + "/excerpts").get(0).get("content").asString())
                .isEqualTo("kept");
        assertThat(chapters.get(0).get("partId").asLong())
                .isEqualTo(getJson("/api/books/" + imported + "/parts").get(0).get("id").asLong());
    }

    @Test
    void archiveFromANewerFormatIsRefused() throws Exception {
        String title = "Future archive " + System.nanoTime();
        byte[] zip = archive(3, title, "{\"formatVersion\":3,\"title\":\"" + title + "\"}");

        for (String url : List.of("/api/migration/import/preview", "/api/migration/import")) {
            String body = mockMvc.perform(multipart(url).file(new MockMultipartFile("file", "f.zip", "application/zip", zip)))
                    .andExpect(status().isBadRequest()).andReturn().getResponse().getContentAsString();
            assertThat(body).contains("format version 3");
        }
        assertThat(getJson("/api/books")).noneMatch(b -> b.get("title").asString().equals(title));
    }

    // ------------------------------------------------------------------ helpers

    private void addToCollection(long collection, long book) throws Exception {
        mockMvc.perform(post("/api/book-collections/" + collection + "/books/" + book))
                .andExpect(status().is2xxSuccessful());
    }

    private byte[] export(long book) throws Exception {
        MvcResult started = mockMvc.perform(get("/api/migration/export/" + book))
                .andExpect(request().asyncStarted()).andReturn();
        return mockMvc.perform(asyncDispatch(started)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
    }

    private JsonNode importArchive(byte[] zip) throws Exception {
        return objectMapper.readTree(mockMvc.perform(multipart("/api/migration/import")
                        .file(new MockMultipartFile("file", "export.zip", "application/zip", zip)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private long bookIdByTitle(String title) throws Exception {
        for (JsonNode b : getJson("/api/books")) {
            if (b.get("title").asString().equals(title)) return b.get("id").asLong();
        }
        throw new AssertionError("no book titled " + title);
    }

    private JsonNode getJson(String url) throws Exception {
        return objectMapper.readTree(mockMvc.perform(get(url)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    private static List<List<String>> paths(JsonNode book) {
        List<List<String>> paths = new ArrayList<>();
        JsonNode node = book.get("collectionPaths");
        if (node == null) return paths;
        for (JsonNode path : node) {
            List<String> names = new ArrayList<>();
            path.forEach(n -> names.add(n.asString()));
            paths.add(names);
        }
        return paths;
    }

    private static byte[] archive(int formatVersion, String title, String bookJson) throws Exception {
        Map<String, byte[]> files = new HashMap<>();
        files.put("manifest.json", ("{\"formatVersion\":" + formatVersion + ",\"exportedAt\":\"2026-01-01T00:00:00\","
                + "\"books\":[{\"slug\":\"b\",\"title\":\"" + title + "\",\"author\":\"Old\","
                + "\"path\":\"books/b/book.json\",\"chapterCount\":1,\"imageCount\":0}]}").getBytes(StandardCharsets.UTF_8));
        files.put("books/b/book.json", bookJson.getBytes(StandardCharsets.UTF_8));
        return zip(files);
    }

    private static Map<String, byte[]> unzip(byte[] zip) throws Exception {
        Map<String, byte[]> files = new HashMap<>();
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip))) {
            for (ZipEntry e; (e = in.getNextEntry()) != null; ) files.put(e.getName(), in.readAllBytes());
        }
        return files;
    }

    private static byte[] zip(Map<String, byte[]> files) throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream out = new ZipOutputStream(bytes)) {
            for (Map.Entry<String, byte[]> f : files.entrySet()) {
                out.putNextEntry(new ZipEntry(f.getKey()));
                out.write(f.getValue());
                out.closeEntry();
            }
        }
        return bytes.toByteArray();
    }
}
