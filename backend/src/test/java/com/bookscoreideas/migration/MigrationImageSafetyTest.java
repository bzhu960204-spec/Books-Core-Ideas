package com.bookscoreideas.migration;

import com.bookscoreideas.support.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * SEC-04: a migration archive may come from someone else, so its image entries are checked like
 * an upload (SEC-02): the type comes from the bytes, the stored name from that type, and what
 * is not imported is reported.
 */
class MigrationImageSafetyTest extends IntegrationTest {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3};
    private static final byte[] SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>"
            .getBytes(StandardCharsets.UTF_8);
    private static final String LONG_NAME = "n".repeat(300) + ".png";

    @Test
    void imagesAreImportedByWhatTheyAreAndTheRestIsReported() throws Exception {
        String title = "Shared archive " + System.nanoTime();
        List<Map<String, Object>> images = List.of(
                image("real.bin", "photo.png", "image/svg+xml", 1),      // a PNG claiming to be SVG
                image("logo.png", "logo.svg", "image/png", 2),           // an SVG claiming to be PNG
                image("scan./evil", "scan.png", "image/png", 3),         // "extension" with a path in it
                image("gone.png", "gone.png", "image/png", 4),           // no file in the archive
                image("long.png", LONG_NAME, "image/png", 5));
        Map<String, byte[]> files = new LinkedHashMap<>();
        files.put("real.bin", PNG);
        files.put("logo.png", SVG);
        files.put("scan./evil", PNG);
        files.put("long.png", PNG);

        JsonNode detail = importArchive(archive(title, images, files)).get("details").get(0);

        assertThat(detail.get("status").asText()).isEqualTo("IMPORTED");
        assertThat(detail.get("imagesImported").asInt()).isEqualTo(3);
        assertThat(detail.get("message").asText())
                .isEqualTo("Skipped 2 images: logo.svg (not a PNG, JPEG, GIF or WebP image); gone.png (missing from the archive)");

        long chapter = importedChapter(title);
        JsonNode stored = getJson("/api/chapters/" + chapter + "/images");
        assertThat(stored).hasSize(3);
        List<String> names = new ArrayList<>();
        for (JsonNode image : stored) {
            names.add(image.get("originalName").asText());
            assertThat(image.get("contentType").asText()).isEqualTo("image/png");
            assertThat(image.get("filename").asText()).matches("[0-9a-f-]{36}\\.png");
            MockHttpServletResponse data = mockMvc.perform(get("/api/chapters/" + chapter + "/images/"
                    + image.get("id").asLong() + "/data")).andExpect(status().isOk()).andReturn().getResponse();
            assertThat(data.getContentAsByteArray()).isEqualTo(PNG);
        }
        assertThat(names).containsExactly("photo.png", "scan.png", LONG_NAME.substring(0, 255));
    }

    @Test
    void aBookWithoutSkippedImagesHasNoMessage() throws Exception {
        String title = "Clean archive " + System.nanoTime();

        JsonNode detail = importArchive(archive(title, List.of(image("a.png", "a.png", "image/png", 1)),
                Map.of("a.png", PNG))).get("details").get(0);

        assertThat(detail.get("status").asText()).isEqualTo("IMPORTED");
        assertThat(detail.get("imagesImported").asInt()).isEqualTo(1);
        assertThat(detail.get("message").isNull()).isTrue();
    }

    private static Map<String, Object> image(String filename, String originalName, String contentType, int order) {
        Map<String, Object> image = new LinkedHashMap<>();
        image.put("filename", filename);
        image.put("originalName", originalName);
        image.put("contentType", contentType);
        image.put("orderIndex", order);
        return image;
    }

    private byte[] archive(String title, List<Map<String, Object>> images, Map<String, byte[]> files) throws Exception {
        Map<String, Object> chapter = new LinkedHashMap<>();
        chapter.put("title", "Ch");
        chapter.put("orderIndex", 1);
        chapter.put("images", images);
        Map<String, Object> book = new LinkedHashMap<>();
        book.put("formatVersion", 2);
        book.put("title", title);
        book.put("author", "Someone else");
        book.put("chapterImagesEnabled", true);
        book.put("structureType", "CHAPTERS");
        book.put("chapters", List.of(chapter));
        Map<String, Object> manifest = Map.of("formatVersion", 2, "exportedAt", "2026-11-01T00:00:00",
                "books", List.of(Map.of("slug", "shared", "title", title, "author", "Someone else",
                        "path", "books/shared/book.json", "chapterCount", 1, "imageCount", images.size())));

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            put(zip, "manifest.json", objectMapper.writeValueAsBytes(manifest));
            put(zip, "books/shared/book.json", objectMapper.writeValueAsBytes(book));
            for (Map.Entry<String, byte[]> file : files.entrySet()) {
                put(zip, "books/shared/images/" + file.getKey(), file.getValue());
            }
        }
        return out.toByteArray();
    }

    private static void put(ZipOutputStream zip, String name, byte[] bytes) throws Exception {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(bytes);
        zip.closeEntry();
    }

    private JsonNode importArchive(byte[] zip) throws Exception {
        return objectMapper.readTree(mockMvc.perform(multipart("/api/migration/import")
                        .file(new MockMultipartFile("file", "shared.zip", "application/zip", zip)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private long importedChapter(String title) throws Exception {
        for (JsonNode book : getJson("/api/books")) {
            if (book.get("title").asText().equals(title)) {
                return getJson("/api/books/" + book.get("id").asLong() + "/chapters").get(0).get("id").asLong();
            }
        }
        throw new AssertionError("book not imported: " + title);
    }

    private JsonNode getJson(String url) throws Exception {
        return objectMapper.readTree(mockMvc.perform(get(url)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
}
