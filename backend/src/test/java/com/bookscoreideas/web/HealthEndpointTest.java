package com.bookscoreideas.web;

import com.bookscoreideas.support.IntegrationTest;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * ENG-06: the start scripts wait for /actuator/health to be UP (the database is reachable),
 * not just for the port to listen. Only that endpoint is exposed, and it shows no details.
 */
class HealthEndpointTest extends IntegrationTest {

    @Test
    void healthIsUpWithoutDetails() throws Exception {
        String body = mockMvc.perform(get("/actuator/health")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(objectMapper.readTree(body)).isEqualTo(objectMapper.readTree("{\"status\":\"UP\"}"));
    }

    @ParameterizedTest(name = "GET {0} -> 404")
    @ValueSource(strings = {"/actuator", "/actuator/env", "/actuator/beans", "/actuator/info",
            "/actuator/configprops", "/actuator/health/db"})
    void nothingElseIsExposed(String url) throws Exception {
        mockMvc.perform(get(url)).andExpect(status().isNotFound());
    }
}
