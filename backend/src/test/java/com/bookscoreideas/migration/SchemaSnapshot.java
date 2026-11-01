package com.bookscoreideas.migration;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * Normalised, order-independent description of an H2 schema: columns (type, length,
 * timestamp precision, nullability, default), constraints (name, columns, ON DELETE
 * rule, target table, CHECK clause) and user-created indexes. Things H2 names by
 * itself (primary keys, indexes it creates for constraints) and column order are
 * left out, because they legitimately differ between databases with the same
 * structure.
 */
final class SchemaSnapshot {

    private static final String COLUMNS = """
            SELECT 'COLUMN', TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, DATETIME_PRECISION,
                   IS_NULLABLE, COLUMN_DEFAULT, IS_IDENTITY
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'PUBLIC' AND TABLE_NAME <> 'flyway_schema_history'
            ORDER BY 2, 3""";

    private static final String CONSTRAINTS = """
            SELECT 'CONSTRAINT', tc.TABLE_NAME,
                   CASE WHEN tc.CONSTRAINT_TYPE = 'PRIMARY KEY' THEN '(primary key)' ELSE tc.CONSTRAINT_NAME END,
                   tc.CONSTRAINT_TYPE,
                   (SELECT LISTAGG(k.COLUMN_NAME, ',') WITHIN GROUP (ORDER BY k.ORDINAL_POSITION)
                    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
                    WHERE k.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND k.CONSTRAINT_NAME = tc.CONSTRAINT_NAME),
                   rc.DELETE_RULE,
                   (SELECT u.TABLE_NAME || '(' ||
                           (SELECT LISTAGG(uk.COLUMN_NAME, ',') WITHIN GROUP (ORDER BY uk.ORDINAL_POSITION)
                            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE uk
                            WHERE uk.CONSTRAINT_SCHEMA = u.CONSTRAINT_SCHEMA AND uk.CONSTRAINT_NAME = u.CONSTRAINT_NAME) || ')'
                    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS u
                    WHERE u.CONSTRAINT_SCHEMA = rc.UNIQUE_CONSTRAINT_SCHEMA AND u.CONSTRAINT_NAME = rc.UNIQUE_CONSTRAINT_NAME),
                   (SELECT cc.CHECK_CLAUSE FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
                    WHERE cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME)
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
            LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
                   ON rc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND rc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
            WHERE tc.TABLE_SCHEMA = 'PUBLIC' AND tc.TABLE_NAME <> 'flyway_schema_history'
            ORDER BY 2, 3, 5""";

    private static final String INDEXES = """
            SELECT 'INDEX', i.TABLE_NAME, i.INDEX_NAME, i.INDEX_TYPE_NAME,
                   (SELECT LISTAGG(c.COLUMN_NAME, ',') WITHIN GROUP (ORDER BY c.ORDINAL_POSITION)
                    FROM INFORMATION_SCHEMA.INDEX_COLUMNS c
                    WHERE c.INDEX_SCHEMA = i.INDEX_SCHEMA AND c.INDEX_NAME = i.INDEX_NAME)
            FROM INFORMATION_SCHEMA.INDEXES i
            WHERE i.TABLE_SCHEMA = 'PUBLIC' AND i.TABLE_NAME <> 'flyway_schema_history'
              AND i.IS_GENERATED = FALSE
            ORDER BY 2, 3""";

    private SchemaSnapshot() {
    }

    static List<String> of(Connection connection) throws SQLException {
        List<String> lines = new ArrayList<>();
        for (String query : List.of(COLUMNS, CONSTRAINTS, INDEXES)) {
            try (Statement s = connection.createStatement(); ResultSet rs = s.executeQuery(query)) {
                ResultSetMetaData meta = rs.getMetaData();
                while (rs.next()) {
                    StringBuilder line = new StringBuilder();
                    for (int i = 1; i <= meta.getColumnCount(); i++) {
                        if (i > 1) line.append(" | ");
                        line.append(rs.getString(i));
                    }
                    lines.add(line.toString());
                }
            }
        }
        return lines;
    }
}
