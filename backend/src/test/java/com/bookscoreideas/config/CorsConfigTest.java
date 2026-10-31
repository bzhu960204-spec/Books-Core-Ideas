package com.bookscoreideas.config;

import com.bookscoreideas.support.IntegrationTest;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpHeaders;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regression for BUG-04: the frontend uses PATCH (mark notes), so a cross-origin
 * dev setup must allow it in the CORS preflight, like the other verbs.
 */
class CorsConfigTest extends IntegrationTest {

    private static final String DEV_ORIGIN = "http://localhost:5173";

    @ParameterizedTest
    @ValueSource(strings = {"GET", "POST", "PUT", "PATCH", "DELETE"})
    void preflightAllowsEveryVerbTheFrontendUses(String method) throws Exception {
        mockMvc.perform(options("/api/marks/1")
                        .header(HttpHeaders.ORIGIN, DEV_ORIGIN)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, method))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, DEV_ORIGIN))
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
