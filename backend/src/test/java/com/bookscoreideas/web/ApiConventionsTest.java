package com.bookscoreideas.web;

import com.bookscoreideas.support.IntegrationTest;
import tools.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * BE-03: one status-code contract for the whole API (doc/api-conventions.md).
 * Creating POST -> 201, DELETE -> 204, a read under a missing parent -> 404, an
 * optional single resource that is absent -> 204, search filters -> 200 [], and
 * errors are ProblemDetail everywhere (migration included).
 */
class ApiConventionsTest extends IntegrationTest {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1};
    private static final long MISSING = 987654321L;

    @Test
    void creatingPostsAre201() throws Exception {
        long book = created(json(post("/api/books"), Map.of("title", "Conventions", "structureType", "PARTS")));
        long part = created(json(post("/api/books/" + book + "/parts"), Map.of("title", "P")));
        long chapter = created(json(post("/api/books/" + book + "/chapters"), Map.of("title", "C", "partId", part)));
        created(json(post("/api/chapters/" + chapter + "/ideas"), Map.of("content", "i")));
        created(json(post("/api/chapters/" + chapter + "/excerpts"), Map.of("content", "e")));
        created(json(post("/api/books/" + book + "/reviews"), Map.of("title", "r", "content", "c")));
        created(json(post("/api/chapters/" + chapter + "/bookmarks"), Map.of("scrollRatio", 0.5)));
        created(json(post("/api/chapters/" + chapter + "/marks"), Map.of("quote", "q")));
        created(json(post("/api/book-collections"), Map.of("name", "Shelf " + book)));
        mockMvc.perform(multipart("/api/chapters/" + chapter + "/images")
                        .file(new MockMultipartFile("files", "a.png", "image/png", PNG)))
                .andExpect(status().isCreated());
    }

    @Test
    void deletesAre204() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Deletes", "structureType", "PARTS"));
        long part = postForId("/api/books/" + book + "/parts", Map.of("title", "P"));
        long chapter = postForId("/api/books/" + book + "/chapters", Map.of("title", "C", "partId", part));
        long other = postForId("/api/books/" + book + "/chapters", Map.of("title", "C2", "partId", part));
        long idea = postForId("/api/chapters/" + chapter + "/ideas", Map.of("content", "i"));
        long excerpt = postForId("/api/chapters/" + chapter + "/excerpts", Map.of("content", "e"));
        long review = postForId("/api/books/" + book + "/reviews", Map.of("title", "r", "content", "c"));
        long bookmark = postForId("/api/chapters/" + chapter + "/bookmarks", Map.of("scrollRatio", 0.5));
        long mark = postForId("/api/chapters/" + chapter + "/marks", Map.of("quote", "q"));
        putJson("/api/chapters/" + chapter + "/explanation", Map.of("content", "x"));
        long image = objectMapper.readTree(mockMvc.perform(multipart("/api/chapters/" + chapter + "/images")
                        .file(new MockMultipartFile("files", "a.png", "image/png", PNG)))
                .andReturn().getResponse().getContentAsString()).get("images").get(0).get("id").asLong();
        long folder = postForId("/api/book-collections", Map.of("name", "Deletes " + book));

        for (String url : new String[]{
                "/api/chapters/" + chapter + "/images/" + image,
                "/api/chapters/" + chapter + "/ideas/" + idea,
                "/api/chapters/" + chapter + "/excerpts/" + excerpt,
                "/api/marks/" + mark, // before the explanation: deleting it removes its marks
                "/api/chapters/" + chapter + "/explanation",
                "/api/bookmarks/" + bookmark,
                "/api/books/" + book + "/reviews/" + review,
                "/api/books/" + book + "/chapters/" + other,
                "/api/books/" + book + "/parts/" + part,
                "/api/book-collections/" + folder,
                "/api/books/" + book}) {
            mockMvc.perform(delete(url)).andExpect(status().isNoContent());
            mockMvc.perform(delete(url)).andExpect(status().isNotFound());
        }
    }

    @ParameterizedTest(name = "GET {0} -> 404")
    @ValueSource(strings = {
            "/api/books/" + MISSING + "/chapters",
            "/api/books/" + MISSING + "/parts",
            "/api/books/" + MISSING + "/reviews",
            "/api/books/" + MISSING + "/marks",
            "/api/books/" + MISSING + "/explanation-chapter-ids",
            "/api/books/" + MISSING + "/bookmarks/latest",
            "/api/book-collections/for-book/" + MISSING,
            "/api/chapters/" + MISSING + "/ideas",
            "/api/chapters/" + MISSING + "/excerpts",
            "/api/chapters/" + MISSING + "/images",
            "/api/chapters/" + MISSING + "/marks",
            "/api/chapters/" + MISSING + "/explanation"})
    void readsUnderAMissingParentAre404(String url) throws Exception {
        mockMvc.perform(get(url))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    // Characterisation: absent optional single resources were already 204 and stay so.
    @Test
    void absentOptionalResourcesAre204() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Optional"));
        long chapter = postForId("/api/books/" + book + "/chapters", Map.of("title", "C"));

        mockMvc.perform(get("/api/chapters/" + chapter + "/explanation")).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/books/" + book + "/bookmarks/latest")).andExpect(status().isNoContent());
    }

    // Characterisation: query parameters filter a search; an unknown book just matches nothing.
    @ParameterizedTest(name = "GET {0} -> 200 []")
    @ValueSource(strings = {"/api/ideas?bookId=" + MISSING, "/api/excerpts?bookId=" + MISSING,
            "/api/bookmarks?bookId=" + MISSING})
    void searchFiltersMatchNothing(String url) throws Exception {
        String body = mockMvc.perform(get(url)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(objectMapper.readTree(body)).isEmpty();
    }

    @ParameterizedTest(name = "POST {0} with a non-archive -> 400 ProblemDetail")
    @ValueSource(strings = {"/api/migration/import", "/api/migration/import/preview"})
    void migrationErrorsAreProblemDetails(String url) throws Exception {
        String body = mockMvc.perform(multipart(url)
                        .file(new MockMultipartFile("file", "notes.zip", "application/zip", "not a zip".getBytes())))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andReturn().getResponse().getContentAsString();
        assertThat(objectMapper.readTree(body).get("detail").asString()).contains("manifest.json");
    }

    // BE-10: Jackson 3's parse errors are unchecked, so they no longer pass through the
    // controller's catch (IOException); a broken manifest must still be a 400, not a 500.
    @ParameterizedTest(name = "POST {0} with a manifest that is not JSON -> 400 ProblemDetail")
    @ValueSource(strings = {"/api/migration/import", "/api/migration/import/preview"})
    void aBrokenManifestIsA400(String url) throws Exception {
        ByteArrayOutputStream zip = new ByteArrayOutputStream();
        try (ZipOutputStream out = new ZipOutputStream(zip)) {
            out.putNextEntry(new ZipEntry("manifest.json"));
            out.write("{\"formatVersion\": 2, \"books\": [".getBytes(StandardCharsets.UTF_8));
            out.closeEntry();
        }
        String body = mockMvc.perform(multipart(url)
                        .file(new MockMultipartFile("file", "broken.zip", "application/zip", zip.toByteArray())))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andReturn().getResponse().getContentAsString();
        assertThat(objectMapper.readTree(body).get("detail").asString()).startsWith("Could not read archive: ");
    }

    // Before, ResponseEntity.of/notFound() answered these with an empty 404 body.
    @ParameterizedTest(name = "{0} -> 404 ProblemDetail")
    @ValueSource(strings = {
            "GET /api/books/" + MISSING,
            "PUT /api/books/" + MISSING,
            "DELETE /api/books/" + MISSING,
            "GET /api/books/" + MISSING + "/export",
            "POST /api/books/" + MISSING + "/chapters",
            "POST /api/chapters/" + MISSING + "/ideas",
            "DELETE /api/marks/" + MISSING,
            "DELETE /api/bookmarks/" + MISSING})
    void missingItemsAre404ProblemDetails(String request) throws Exception {
        String[] parts = request.split(" ");
        Map<String, Object> body = Map.of("title", "t", "content", "c");
        mockMvc.perform(json(request(HttpMethod.valueOf(parts[0]), parts[1]), body))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, Map<String, ?> body)
            throws Exception {
        return request.contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body));
    }

    private long created(MockHttpServletRequestBuilder request) throws Exception {
        String body = mockMvc.perform(request).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        JsonNode node = objectMapper.readTree(body);
        return node.get("id").asLong();
    }
}
