package com.bookscoreideas.migration;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationState;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Arrays;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Existing (legacy) databases were created by Hibernate and adopted by Flyway
 * with baseline-version=0 (see application.properties). On those, V0 must be
 * skipped while V1..Vn still apply.
 */
class LegacyDatabaseMigrationTest {

    @Test
    void baselinedLegacyDatabaseSkipsV0AndAppliesTheRest() throws Exception {
        String url = "jdbc:h2:mem:legacy-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1";

        // Simulate a pre-Flyway, Hibernate-created database: core tables exist but
        // lack columns that later migrations add.
        try (Connection c = DriverManager.getConnection(url, "sa", "");
             Statement s = c.createStatement()) {
            s.execute("RUNSCRIPT FROM 'classpath:db/migration/V0__base_schema.sql'");
            s.execute("ALTER TABLE BOOKS DROP COLUMN STRUCTURE_TYPE");
            s.execute("INSERT INTO BOOKS (TITLE) VALUES ('Legacy Book')");
        }

        Flyway flyway = Flyway.configure()
                .dataSource(url, "sa", "")
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .load();
        flyway.migrate();

        MigrationInfo v0 = Arrays.stream(flyway.info().all())
                .filter(i -> !i.getType().isBaseline())
                .filter(i -> i.getVersion() != null && "0".equals(i.getVersion().getVersion()))
                .findFirst().orElseThrow();
        assertThat(v0.getState()).isIn(MigrationState.BASELINE_IGNORED, MigrationState.BELOW_BASELINE);
        assertThat(flyway.info().pending()).isEmpty();
        assertThat(flyway.info().applied())
                .allSatisfy(i -> assertThat(i.getState().isFailed()).isFalse());

        try (Connection c = DriverManager.getConnection(url, "sa", "");
             Statement s = c.createStatement();
             ResultSet rs = s.executeQuery("SELECT STRUCTURE_TYPE FROM BOOKS WHERE TITLE = 'Legacy Book'")) {
            assertThat(rs.next()).isTrue();
            assertThat(rs.getString(1)).isEqualTo("CHAPTERS");
        }
    }
}
