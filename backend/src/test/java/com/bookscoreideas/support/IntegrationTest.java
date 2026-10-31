package com.bookscoreideas.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Base class for full-stack tests: real Spring context, Flyway-built schema on an
 * isolated in-memory H2 database (see application-test.properties), MockMvc for HTTP.
 * The context (and its database) is shared across test classes, so tests must
 * create their own data and not assume an empty database.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class IntegrationTest {

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    protected JsonNode postJson(String url, Object body) throws Exception {
        return sendJson(post(url), body);
    }

    protected JsonNode putJson(String url, Object body) throws Exception {
        return sendJson(put(url), body);
    }

    protected long postForId(String url, Object body) throws Exception {
        return postJson(url, body).get("id").asLong();
    }

    private JsonNode sendJson(MockHttpServletRequestBuilder request, Object body) throws Exception {
        String response = mockMvc.perform(request
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().is2xxSuccessful())
                .andReturn().getResponse().getContentAsString();
        return response.isEmpty() ? null : objectMapper.readTree(response);
    }
}
