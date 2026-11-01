# 数据库 Schema 管理与 Flyway

> 更新于 2026-10-31（DB-01 完成后）。说明 schema 由谁负责、空库/老库分别如何迁移、测试如何防回归。
> 历史背景：早期 schema 完全由 Hibernate `ddl-auto=update` 生成，V1–V7 是给老库打的"补丁"，
> 因此曾出现"空库启动时 Flyway 报 `Table "BOOKS" not found`"的问题（BUG-01），老库与空库的结构也不一致。

## 1. 现状

- 数据库：文件型 H2，`jdbc:h2:file:./data/booksdb`（`backend/data/`，可能是指向 OneDrive 的 junction，见 `setup-data-link.ps1`）。
- **Flyway 是唯一的 schema 来源**；`spring.jpa.hibernate.ddl-auto=validate`：Hibernate 只校验实体与表结构一致，不一致则拒绝启动，**不再改表**。
- `spring.flyway.baseline-on-migrate=true`，`baseline-version=0`（用于接管 Flyway 之前由 Hibernate 建的库）。

迁移脚本：`backend/src/main/resources/db/migration/`

| 版本 | 作用 |
|---|---|
| V0 `base_schema` | 空库专用：创建核心表 BOOKS / PARTS / CHAPTERS / KEY_IDEAS / EXCERPTS / BOOK_REVIEWS / CHAPTER_IMAGES |
| V1–V7 | 历史补丁：补列、改约束、新增 CHAPTER_EXPLANATIONS、BOOK_COLLECTIONS(+ITEMS)、READING_BOOKMARKS、EXPLANATION_MARKS |
| V8 `normalize_schema` | 把老库与空库统一成同一份结构：约束/索引统一命名、外键列都有命名索引、`STRUCTURE_TYPE` 等列类型/默认值对齐、标志列 NOT NULL（DB-01） |
| V9 `foreign_keys_and_cascades` | 外键删除规则（见下表）、补齐书单相关外键、子表外键列 NOT NULL、复合外键保证冗余 `book_id` 一致（DB-02） |

### 外键删除规则（V9 起）

| 外键 | 规则 |
|---|---|
| 书 → Part / 章节 / 书评 / 书单成员 | `ON DELETE CASCADE` |
| 章节 → 想法 / 摘录 / 讲解 / 书签 / 标记 | `ON DELETE CASCADE` |
| Part → 章节 | `ON DELETE CASCADE`（复合外键 `(PART_ID, BOOK_ID)`，Part 必须属于同一本书） |
| 书单 → 子书单 / 成员 | `ON DELETE CASCADE` |
| 书签 / 标记 → 章节 | 复合外键 `(CHAPTER_ID, BOOK_ID) → CHAPTERS(ID, BOOK_ID)`，保证 `BOOK_ID` 与章节一致 |
| **章节 → 章节图片** | **`ON DELETE RESTRICT`**：图片文件只由 JPA 实体监听器删除，绕过 JPA 的删除不能悄悄删掉图片行 |

应用里的删除仍走 JPA 级联（两者同时生效）。手动用 SQL 删书时，数据库会级联删除；但如果书中有图片，会被拒绝，此时请走 API。

**写服务层删除代码的注意点**：同一事务中，要先删子行再删父行。如果先删父行，数据库会级联把子行删掉，Hibernate 随后再删子行时影响 0 行，就会报错。`BookCollectionService.delete` 就是按这个顺序写的。

## 2. 两种数据库各自怎么走

| 场景 | Flyway 行为 |
|---|---|
| **空库**（新 clone / 新机器） | schema 为空 → 不做基线，从 **V0** 开始依次执行 V0…最新。 |
| **老库**（当初由 Hibernate 建表、后被 Flyway 以版本 0 基线接管） | 历史表里有 `<< Flyway Baseline >>`（版本 0），V0 被跳过（`BASELINE_IGNORED`），其余按版本执行。 |

两条路径的最终结构**完全一致**（由 `SchemaConvergenceTest` 保证）。V8、V9 已在真实库副本上演练：迁移成功，12 张表内容逐行一致，2,724 个 GET 响应与改动前零差异。

## 3. 命名约定

| 对象 | 格式 | 例 |
|---|---|---|
| 外键 | `FK_<子表>_<目标>` | `FK_CHAPTERS_BOOK`、`FK_KEY_IDEAS_CHAPTER` |
| 唯一约束 | `UK_<表>_<列…>` | `UK_CHAPTER_EXPLANATIONS_CHAPTER` |
| 索引 | `IDX_<表>_<列>` | `IDX_CHAPTERS_PART` |

- 每个外键列都先建命名索引、再加外键：H2 会复用该索引；否则 H2 会额外建一个系统命名的重复索引。
- 主键沿用 H2 系统名（`CONSTRAINT_xx`），不参与比较。

## 4. 测试（防回归）

`backend/src/test/`，运行：`cd backend; .\mvnw.cmd test`

- `application-test.properties`：每个 Spring 上下文使用独立的随机内存库；与生产一样 `ddl-auto=validate`。
- `FreshDatabaseMigrationTest`：空库上全部迁移成功、无待执行迁移，并做一次建书/读书的 API 冒烟。
- `LegacyDatabaseMigrationTest`：模拟 Flyway 之前的老库（预先存在的表 + 版本 0 基线），断言 V0 被跳过、其余迁移成功、数据保留。
- `SchemaConvergenceTest`：
  - 以 `src/test/resources/db/legacy-schema-v7.sql`（真实库在 V8 之前的 `SCRIPT NODATA` 结构，不含数据）为起点迁移，要求最终的 INFORMATION_SCHEMA（列、类型、可空、默认值、约束名及定义、ON DELETE 规则、索引）与空库**逐项相同**。
  - 同时检查老数据在迁移后保留。
  - 检查遇到未知约束（V8）或违规数据（V9）时，迁移在改动任何东西之前就中止。
- `ForeignKeyConstraintsTest`：直接用 SQL 验证数据库自身的级联、RESTRICT、NOT NULL 与复合外键。

## 5. 新增迁移的约定

1. 新建 `V{n}__描述.sql`，**不要修改已执行过的脚本**（会导致 checksum 校验失败）。
2. 改实体就必须配一个迁移；只改实体会让 `validate` 启动失败（测试会先失败）。
3. 必须同时适用于空库与老库；V8 之后两者结构相同，写一份普通 DDL 即可，不再需要 `IF NOT EXISTS` 兼容写法。
4. **H2 的 DDL 逐条自动提交**，迁移中途失败会留下半成品。对可能失败的前提条件（数据不满足约束、结构不是预期形状），在脚本开头用"守卫查询"检查，**在任何改动之前**中止。写法参见 V8：`SELECT CAST('V<n> aborted: 原因' AS INT) AS V<n>_CHECK_xxx FROM … WHERE <异常条件>`。别名必须起：Flyway 会把每个 SELECT 的（空）结果连同列名打印到日志，不起别名时列名就是表达式原文，成功的迁移也会在日志里显示"aborted"字样。
5. 涉及真实数据的变更，先停应用并执行 `.\backup-data.ps1 -Label before-xxx`，并在备份副本上演练（迁移成功 + 各表行数/内容不变 + GET 接口响应对比）。
6. 实体映射与 SQL 类型要一致（例如 CLOB 字段在实体上用 `@Lob`）；约束/索引名在实体注解里也写成同样的名字，便于对照。

## 6. 排错备忘

- **`Validate failed / Detected failed migration to version N`**：历史表中残留 `success=FALSE` 的记录。
  在无 Java 进程占用数据库时执行（等价于 `flyway repair`）：
  ```sql
  DELETE FROM "flyway_schema_history" WHERE "success"=FALSE;
  ```
- **直接查询 H2 文件**：用 `~/.m2/repository/com/h2database/h2/2.2.224/h2-2.2.224.jar`（库为 H2 2.2 格式），
  例如 `java -cp <h2.jar> org.h2.tools.RunScript -url jdbc:h2:file:<dir>/booksdb -user sa -script q.sql -showResults`。
  务必在应用停止时操作，或操作备份的副本。
- **Java 版本**：项目需要 Java 17；若 `JAVA_HOME` 指向旧版本，Maven 的 enforcer 会直接报 "Java 17 or newer is required"。
  start-dev / start-prod / build-prod 支持在仓库根放 `.java-home` 文件指定 JDK 路径（ENG-04）。