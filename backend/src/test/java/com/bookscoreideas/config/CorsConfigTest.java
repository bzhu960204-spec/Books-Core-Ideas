package com.bookscoreideas.config;

import com.bookscoreideas.support.IntegrationTest;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.TestPropertySource;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * CORS when explicitly turned on (APP_CORS_ALLOWED_ORIGINS, comma-separated; off by
 * default, see CorsDefaultTest). Regression for BUG-04: the frontend uses PATCH (mark
 * notes), so a cross-origin setup must allow it in the preflight, like the other verbs.
 */
@TestPropertySource(properties = "app.cors.allowed-origins=http://localhost:5173, http://127.0.0.1:5173")
class CorsConfigTest extends IntegrationTest {

    @ParameterizedTest
    @CsvSource({
            "GET, http://localhost:5173", "POST, http://localhost:5173", "PUT, http://localhost:5173",
            "PATCH, http://localhost:5173", "DELETE, http://localhost:5173", "PATCH, http://127.0.0.1:5173"})
    void preflightAllowsEveryVerbTheFrontendUses(String method, String origin) throws Exception {
        mockMvc.perform(options("/api/marks/1")
                        .header(HttpHeaders.ORIGIN, origin)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, method))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, origin))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, containsString(method)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://evil.example", "http://localhost:9999"})
    void preflightRejectsOtherOrigins(String origin) throws Exception {
        mockMvc.perform(options("/api/books")
                        .header(HttpHeaders.ORIGIN, origin)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isForbidden());
    }
}
