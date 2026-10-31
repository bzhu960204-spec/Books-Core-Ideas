package com.bookscoreideas.migration;

import com.bookscoreideas.support.IntegrationTest;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regression for BUG-01: the app must start on a brand-new empty database, with
 * Flyway alone producing a schema that Hibernate validates (ddl-auto=validate).
 */
class FreshDatabaseMigrationTest extends IntegrationTest {

    @Autowired
    private Flyway flyway;

    @Test
    void allMigrationsApplyCleanlyOnEmptyDatabase() {
        MigrationInfo[] applied = flyway.info().applied();

        assertThat(applied).isNotEmpty();
        assertThat(applied).allSatisfy(info -> assertThat(info.getState().isFailed()).isFalse());
        assertThat(flyway.info().pending()).isEmpty();
        assertThat(Arrays.stream(applied).map(i -> i.getVersion().getVersion()))
                .contains("0", "1", "2");
    }

    @Test
    void basicBookRoundTripWorks() throws Exception {
        String body = mockMvc.perform(post("/api/books")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Fresh DB Book\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String id = body.replaceAll(".*\"id\":(\\d+).*", "$1");

        mockMvc.perform(get("/api/books/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Fresh DB Book"))
                .andExpect(jsonPath("$.structureType").value("CHAPTERS"));
    }
}
