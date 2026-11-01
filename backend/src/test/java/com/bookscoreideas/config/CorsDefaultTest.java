package com.bookscoreideas.config;

import com.bookscoreideas.support.IntegrationTest;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpHeaders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;

/**
 * BE-09: dev (Vite proxy) and prod (single port) are both same-origin, so by default no
 * other origin may call the API. Otherwise any page on the allowed origin, e.g. another
 * project's Vite server on port 5173, could delete data from a browser.
 */
class CorsDefaultTest extends IntegrationTest {

    @ParameterizedTest
    @ValueSource(strings = {"http://localhost:5173", "http://evil.example"})
    void noOriginIsAllowedByDefault(String origin) throws Exception {
        mockMvc.perform(options("/api/books")
                        .header(HttpHeaders.ORIGIN, origin)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "DELETE"))
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
        mockMvc.perform(get("/api/books").header(HttpHeaders.ORIGIN, origin))
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }
}
