package com.bookscoreideas.web;

import com.bookscoreideas.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The single-port prod mode serves the frontend and falls back to index.html for client
 * routes, but never for backend paths: those answer for themselves or 404 (ENG-06 added
 * /actuator, where only health is exposed).
 */
class SpaFallbackTest extends IntegrationTest {

    private static final Path DIST = createDist();

    private static Path createDist() {
        try {
            Path dir = Files.createTempDirectory("bci-dist-");
            Files.writeString(dir.resolve("index.html"), "<div id=\"root\"></div>");
            dir.toFile().deleteOnExit();
            dir.resolve("index.html").toFile().deleteOnExit();
            return dir;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @DynamicPropertySource
    static void dist(DynamicPropertyRegistry registry) {
        registry.add("app.web.dist", DIST::toString);
    }

    @Test
    void clientRoutesGetTheFrontend() throws Exception {
        String body = mockMvc.perform(get("/book/1")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(body).contains("id=\"root\"");
    }

    @Test
    void healthStillAnswers() throws Exception {
        String body = mockMvc.perform(get("/actuator/health")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(body).contains("\"UP\"");
    }

    @ParameterizedTest(name = "GET {0} -> 404, not index.html")
    @ValueSource(strings = {"/api/nothing-here", "/actuator/env", "/actuator/beans"})
    void backendPathsAreNotTheFrontend(String url) throws Exception {
        mockMvc.perform(get(url)).andExpect(status().isNotFound());
    }
}
