package com.bookscoreideas.web;

import com.bookscoreideas.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regression for BUG-07 / BE-04: client errors must map to 4xx with an RFC 7807
 * problem body (whose "detail" the frontend shows), never a bare 500.
 */
class ErrorHandlingTest extends IntegrationTest {

    @Test
    void missingCollectionIs404WithProblemDetail() throws Exception {
        mockMvc.perform(get("/api/book-collections/987654321/books"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.detail", containsString("987654321")));
    }

    @Test
    void addingMissingBookToCollectionIs404() throws Exception {
        long collectionId = postForId("/api/book-collections", Map.of("name", "Errors shelf"));

        mockMvc.perform(post("/api/book-collections/" + collectionId + "/books/987654321"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail", containsString("Book not found")));
    }

    @Test
    void invalidCollectionMoveIs400() throws Exception {
        long collectionId = postForId("/api/book-collections", Map.of("name", "Self parent"));

        mockMvc.perform(put("/api/book-collections/" + collectionId + "/move")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"parentId\":" + collectionId + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.detail", containsString("own parent")));
    }

    @Test
    void blankCollectionNameIs400() throws Exception {
        mockMvc.perform(post("/api/book-collections")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail", containsString("blank")));
    }

    @Test
    void validationFailureIs400ProblemDetail() throws Exception {
        mockMvc.perform(post("/api/books")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail", containsString("title")));
    }

    @Test
    void malformedJsonIs400ProblemDetail() throws Exception {
        mockMvc.perform(post("/api/books")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }
}
