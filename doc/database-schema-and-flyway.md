# 数据库 Schema 管理与 Flyway

> 更新于 2026-10-31（BUG-01 修复后）。说明 schema 由谁负责、空库/老库分别如何迁移、测试如何防回归。
> 历史背景：早期 schema 完全由 Hibernate `ddl-auto=update` 生成，V1–V7 是给老库打的"补丁"，
> 因此曾出现"空库启动时 Flyway 报 `Table "BOOKS" not found`"的问题（BUG-01）。

## 1. 现状

- 数据库：文件型 H2，`jdbc:h2:file:./data/booksdb`（`backend/data/`，可能是指向 OneDrive 的 junction，见 `setup-data-link.ps1`）。
- `spring.flyway.enabled=true`，`baseline-on-migrate=true`，`baseline-version=0`。
- `spring.jpa.hibernate.ddl-auto=update` 仍保留（过渡期兜底）；长期目标是改为 `validate`，见
  [improvement-review/03 DB-01](improvement-review/03-database-and-data-safety.md#db-01)。

迁移脚本：`backend/src/main/resources/db/migration/`

| 版本 | 作用 |
|---|---|
| V0 `base_schema` | 创建核心表 BOOKS / PARTS / CHAPTERS / KEY_IDEAS / EXCERPTS / BOOK_REVIEWS / CHAPTER_IMAGES（当前结构，约束名与 Hibernate 生成的一致） |
| V1–V7 | 历史补丁：补列、改约束、新增 CHAPTER_EXPLANATIONS、BOOK_COLLECTIONS(+ITEMS)、READING_BOOKMARKS、EXPLANATION_MARKS |

## 2. 两种数据库各自怎么走

| 场景 | Flyway 行为 |
|---|---|
| **空库**（新 clone / 新机器） | schema 为空 → 不做基线，从 **V0** 开始依次执行 V0…V7。V0 建好核心表，后续补丁都能成功。 |
| **老库**（当初由 Hibernate 建表、后被 Flyway 以版本 0 基线接管） | 历史表里有 `<< Flyway Baseline >>`（版本 0）。V0 版本等于基线 → 状态 `BASELINE_IGNORED`，**不会执行**；V1–V7 早已成功，不再执行。 |

已在真实库副本上验证：`Successfully validated 9 migrations … Schema "PUBLIC" is up to date. No migration necessary.`，数据完整。

## 3. 测试（防回归）

`backend/src/test/`，运行：`cd backend; mvn test`

- `application-test.properties`：每个 Spring 上下文使用独立的随机内存库；**`ddl-auto=validate`**，即表结构只能由 Flyway 生成，Hibernate 只做校验。
- `FreshDatabaseMigrationTest`：空库上全部迁移成功、无待执行迁移，并做一次建书/读书的 API 冒烟。
- `LegacyDatabaseMigrationTest`：模拟老库（预先存在的表 + 版本 0 基线），断言 V0 被跳过、其余迁移成功、数据保留。

## 4. 新增迁移的约定

1. 新建 `V{n}__描述.sql`，**不要修改已执行过的脚本**（会导致 checksum 校验失败）。
2. 必须同时适用于空库与老库；`mvn test` 会在两种场景下验证。
3. 涉及真实数据的变更，先停应用并执行 `.\backup-data.ps1 -Label before-xxx`。
4. 实体映射与 SQL 类型要一致（例如 CLOB 字段在实体上用 `@Lob`），否则 `validate` 测试会失败。

## 5. 排错备忘

- **`Validate failed / Detected failed migration to version N`**：历史表中残留 `success=FALSE` 的记录。
  在无 Java 进程占用数据库时执行（等价于 `flyway repair`）：
  ```sql
  DELETE FROM "flyway_schema_history" WHERE "success"=FALSE;
  ```
- **直接查询 H2 文件**：用 `~/.m2/repository/com/h2database/h2/2.2.224/h2-2.2.224.jar`（库为 H2 2.2 格式），
  例如 `java -cp <h2.jar> org.h2.tools.RunScript -url jdbc:h2:file:<dir>/booksdb -user sa -script q.sql -showResults`。
  务必在应用停止时操作，或操作备份的副本。
- **Java 版本**：项目需要 Java 17；若 `JAVA_HOME` 指向旧版本，`mvn` 会报 `bad major version`。
  `start-prod.ps1` 支持在仓库根放 `.java-home` 文件指定 JDK 路径。