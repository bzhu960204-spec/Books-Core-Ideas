package com.bookscoreideas.books;

import com.bookscoreideas.service.ChapterImageStorage;
import com.bookscoreideas.support.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Chapter images and their files, including a migration round trip (BE-01 ④ / BE-06). */
class ImageApiTest extends IntegrationTest {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3};

    @Autowired private ChapterImageStorage storage;

    @Test
    void uploadServeAndDelete() throws Exception {
        long chapter = chapterIn(postForId("/api/books", Map.of("title", "Images")));
        String base = "/api/chapters/" + chapter + "/images";

        JsonNode saved = upload(base,
                new MockMultipartFile("files", "page.png", "image/png", PNG),
                new MockMultipartFile("files", "notes.txt", "text/plain", "x".getBytes()),
                new MockMultipartFile("files", "empty.png", "image/png", new byte[0]));

        assertThat(saved).hasSize(1);
        JsonNode image = saved.get(0);
        assertThat(fieldNames(image)).containsExactly("id", "filename", "originalName", "contentType", "orderIndex");
        assertThat(image.get("originalName").asText()).isEqualTo("page.png");
        assertThat(image.get("filename").asText()).endsWith(".png");
        Path file = storage.resolve(image.get("filename").asText()).orElseThrow();
        assertThat(file).exists();
        assertThat(fieldNames(getJson(base).get(0))).containsExactly("id", "filename", "originalName", "contentType", "orderIndex");

        long id = image.get("id").asLong();
        MvcResult data = mockMvc.perform(get(base + "/" + id + "/data")).andExpect(status().isOk()).andReturn();
        assertThat(data.getResponse().getContentAsByteArray()).isEqualTo(PNG);
        assertThat(data.getResponse().getContentType()).isEqualTo("image/png");
        assertThat(data.getResponse().getHeader(HttpHeaders.CONTENT_DISPOSITION)).isEqualTo("inline; filename=\"page.png\"");

        mockMvc.perform(delete(base + "/" + id)).andExpect(status().isOk());
        assertThat(file).doesNotExist();
        mockMvc.perform(get(base + "/" + id + "/data")).andExpect(status().isNotFound());
        mockMvc.perform(delete(base + "/" + id)).andExpect(status().isNotFound());
    }

    @Test
    void missingFileOrChapterIs404() throws Exception {
        long chapter = chapterIn(postForId("/api/books", Map.of("title", "Gone")));
        JsonNode saved = upload("/api/chapters/" + chapter + "/images", new MockMultipartFile("files", "a.png", "image/png", PNG));
        Files.delete(storage.resolve(saved.get(0).get("filename").asText()).orElseThrow());

        mockMvc.perform(get("/api/chapters/" + chapter + "/images/" + saved.get(0).get("id").asLong() + "/data"))
                .andExpect(status().isNotFound());
        mockMvc.perform(multipart("/api/chapters/999999/images").file(new MockMultipartFile("files", "a.png", "image/png", PNG)))
                .andExpect(status().isNotFound());
    }

    @Test
    void migrationRoundTripCarriesImageFiles() throws Exception {
        String title = "Migrated " + System.nanoTime();
        long book = postForId("/api/books", Map.of("title", title, "chapterImagesEnabled", true));
        long chapter = chapterIn(book);
        upload("/api/chapters/" + chapter + "/images", new MockMultipartFile("files", "scan.png", "image/png", PNG));

        MvcResult started = mockMvc.perform(get("/api/migration/export/" + book))
                .andExpect(request().asyncStarted()).andReturn();
        byte[] zip = mockMvc.perform(asyncDispatch(started)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        mockMvc.perform(delete("/api/books/" + book)).andExpect(status().isOk());

        JsonNode result = objectMapper.readTree(mockMvc.perform(multipart("/api/migration/import")
                        .file(new MockMultipartFile("file", "export.zip", "application/zip", zip)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(result.get("booksImported").asInt()).isEqualTo(1);
        assertThat(result.get("details").get(0).get("imagesImported").asInt()).isEqualTo(1);

        long imported = 0;
        for (JsonNode b : getJson("/api/books")) if (b.get("title").asText().equals(title)) imported = b.get("id").asLong();
        long importedChapter = getJson("/api/books/" + imported + "/chapters").get(0).get("id").asLong();
        JsonNode images = getJson("/api/chapters/" + importedChapter + "/images");
        assertThat(images).hasSize(1);
        byte[] bytes = mockMvc.perform(get("/api/chapters/" + importedChapter + "/images/"
                        + images.get(0).get("id").asLong() + "/data"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        assertThat(bytes).isEqualTo(PNG);
    }

    private long chapterIn(long book) throws Exception {
        return postForId("/api/books/" + book + "/chapters", Map.of("title", "Ch"));
    }

    private JsonNode upload(String url, MockMultipartFile... files) throws Exception {
        var request = multipart(url);
        for (MockMultipartFile f : files) request.file(f);
        return objectMapper.readTree(mockMvc.perform(request).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
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
