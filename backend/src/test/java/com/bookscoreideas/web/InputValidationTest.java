package com.bookscoreideas.web;

import com.bookscoreideas.support.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;

import java.util.HashMap;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * BE-05: request bodies are validated against what the database and the UI accept.
 * Before, over-long text reached the database (409/500 from a "value too long"
 * error), out-of-range ratings were stored (and crashed the library page, which
 * draws 5 - rating empty stars), and unknown status/structure values were stored.
 * Now each is a 400 ProblemDetail naming the field, and boundary values still pass.
 */
class InputValidationTest extends IntegrationTest {

    private long book;
    private long chapter;
    private long review;

    @BeforeEach
    void data() throws Exception {
        book = postForId("/api/books", Map.of("title", "Validation"));
        chapter = postForId("/api/books/" + book + "/chapters", Map.of("title", "C"));
        review = postForId("/api/books/" + book + "/reviews", Map.of("title", "r", "content", "c"));
    }

    static Stream<Arguments> invalid() {
        return Stream.of(
                Arguments.of("POST", "/api/books", body("title", s(256)), "title"),
                Arguments.of("POST", "/api/books", body("title", "t", "author", s(256)), "author"),
                Arguments.of("POST", "/api/books", body("title", "t", "isbn", s(256)), "isbn"),
                Arguments.of("POST", "/api/books", body("title", "t", "description", s(2001)), "description"),
                Arguments.of("POST", "/api/books", body("title", "t", "coverUrl", s(256)), "coverUrl"),
                Arguments.of("POST", "/api/books", body("title", "t", "category", s(256)), "category"),
                Arguments.of("POST", "/api/books", body("title", "t", "rating", 0), "rating"),
                Arguments.of("POST", "/api/books", body("title", "t", "rating", 6), "rating"),
                Arguments.of("POST", "/api/books", body("title", "t", "readingStatus", "DONE"), "readingStatus"),
                Arguments.of("POST", "/api/books", body("title", "t", "structureType", "TREE"), "structureType"),
                Arguments.of("PUT", "/api/books/{book}", body("title", s(256)), "title"),
                Arguments.of("PUT", "/api/books/{book}", body("title", "t", "rating", 6), "rating"),
                Arguments.of("PUT", "/api/books/{book}", body("title", "t", "readingStatus", "reading"), "readingStatus"),
                Arguments.of("POST", "/api/books/{book}/chapters", body("title", s(256)), "title"),
                Arguments.of("PUT", "/api/books/{book}/chapters/{chapter}", body("title", s(256)), "title"),
                Arguments.of("POST", "/api/books/{book}/parts", body("title", s(256)), "title"),
                Arguments.of("POST", "/api/books/{book}/parts", body("title", "p", "summary", s(1001)), "summary"),
                Arguments.of("POST", "/api/chapters/{chapter}/ideas", body("content", s(3001)), "content"),
                Arguments.of("POST", "/api/chapters/{chapter}/ideas", body("content", "i", "example", s(3001)), "example"),
                Arguments.of("POST", "/api/chapters/{chapter}/ideas", body("content", "i", "tags", s(501)), "tags"),
                Arguments.of("POST", "/api/chapters/{chapter}/excerpts", body("content", "e", "note", s(1001)), "note"),
                Arguments.of("POST", "/api/chapters/{chapter}/excerpts", body("content", "e", "source", s(301)), "source"),
                Arguments.of("POST", "/api/books/{book}/reviews", body("title", s(256), "content", "c"), "title"),
                Arguments.of("PUT", "/api/books/{book}/reviews/{review}", body("title", s(256), "content", "c"), "title"),
                Arguments.of("POST", "/api/chapters/{chapter}/bookmarks", body("note", s(501)), "note"),
                Arguments.of("POST", "/api/chapters/{chapter}/bookmarks", body("scrollRatio", "half"), "scrollRatio"),
                Arguments.of("POST", "/api/chapters/{chapter}/marks", body("quote", "  "), "quote"));
    }

    @ParameterizedTest(name = "{0} {1} -> 400 on {3}")
    @MethodSource("invalid")
    void invalidInputIsA400NamingTheField(String method, String url, Map<String, Object> body, String field)
            throws Exception {
        JsonNode problem = send(method, url, body, 400);
        assertThat(problem.get("status").asInt()).isEqualTo(400);
        assertThat(problem.get("detail").asText()).contains(field);
    }

    static Stream<Arguments> boundaries() {
        return Stream.of(
                Arguments.of("POST", "/api/books", body("title", s(255), "author", s(255), "description", s(2000),
                        "rating", 5, "readingStatus", "", "structureType", "PARTS")),
                Arguments.of("POST", "/api/books", body("title", "t", "rating", 1, "readingStatus", "WANT_TO_READ")),
                Arguments.of("PUT", "/api/books/{book}", body("title", "t", "rating", null, "readingStatus", null)),
                Arguments.of("PUT", "/api/books/{book}", body("title", "t", "readingStatus", "FINISHED",
                        "structureType", "CHAPTERS")),
                Arguments.of("POST", "/api/chapters/{chapter}/ideas", body("content", s(3000), "tags", s(500))),
                Arguments.of("POST", "/api/chapters/{chapter}/excerpts", body("content", s(5000), "note", s(1000),
                        "source", s(300))),
                Arguments.of("POST", "/api/chapters/{chapter}/bookmarks", body("scrollRatio", 0.5, "note", s(500))),
                Arguments.of("POST", "/api/chapters/{chapter}/bookmarks", body()),
                Arguments.of("POST", "/api/books/{book}/reviews", body("title", s(255), "content", s(5000))));
    }

    @ParameterizedTest(name = "{0} {1} accepts boundary values")
    @MethodSource("boundaries")
    void boundaryValuesAreAccepted(String method, String url, Map<String, Object> body) throws Exception {
        send(method, url, body, method.equals("PUT") ? 200 : -1);
    }

    /** expectedStatus -1: any 2xx. */
    private JsonNode send(String method, String url, Map<String, Object> body, int expectedStatus) throws Exception {
        String path = url.replace("{book}", Long.toString(book)).replace("{chapter}", Long.toString(chapter))
                .replace("{review}", Long.toString(review));
        var result = mockMvc.perform(request(HttpMethod.valueOf(method), path)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(expectedStatus < 0 ? status().is2xxSuccessful() : status().is(expectedStatus))
                .andReturn().getResponse();
        String text = result.getContentAsString();
        return text.isEmpty() ? null : objectMapper.readTree(text);
    }

    private static Map<String, Object> body(Object... keyValues) {
        Map<String, Object> map = new HashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) map.put((String) keyValues[i], keyValues[i + 1]);
        return map;
    }

    private static String s(int length) {
        return "x".repeat(length);
    }
}
