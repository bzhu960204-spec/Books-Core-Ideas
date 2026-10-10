# 数据库 Schema 管理与 Flyway（排错 & 重建参考）

> 记录于 2026-10-10。本文说明本项目的数据库 schema 是怎么管理的、为什么从零克隆时
> 启动会报 Flyway 错误，以及如何正确地"从零重建数据库"。

## 1. 背景：schema 由谁负责

- 数据库是文件型 H2：`jdbc:h2:file:./data/booksdb`，文件在 `backend/data/` 下
  （该目录通常是指向 OneDrive `ProjectData\books-core-ideas\data` 的 junction，
  真实数据靠 OneDrive 同步，见 `setup-data-link.ps1`）。
- **当前 schema 的唯一来源是 Hibernate 的 `spring.jpa.hibernate.ddl-auto=update`**，
  它会根据实体类在首次启动时建出全部表。
- `backend/src/main/resources/db/migration/` 下的 `V1..V6` 是**历史遗留的"补丁"脚本**，
  当初是用来给老数据库补 Hibernate 漏掉的列/约束的，不是用来从零建库的。
- 因此 **Flyway 目前是关闭的**（`spring.flyway.enabled=false`）。

## 2. 症状：从零克隆首次启动报错

典型报错（启动中止，8080 一直起不来，Tomcat 被 stop）：

```
Validate failed: Migrations have failed validation
Detected failed migration to version 2 (add parts).
```

删掉失败记录让它重跑后，会暴露更底层的真正错误：

```
Table "BOOKS" not found; SQL statement:
UPDATE BOOKS SET STRUCTURE_TYPE = 'CHAPTERS' WHERE STRUCTURE_TYPE IS NULL
Location : db/migration/V2__add_parts.sql  Line: 9
```

## 3. 根因：Flyway 跑在 Hibernate 之前（鸡生蛋死锁）

Spring Boot 启动顺序是 **Flyway 先于 Hibernate**。而 V1–V6 都**假设基础表
（BOOKS、CHAPTERS…）已经存在**，只负责打补丁。在一个"真正的空库"上逐个会失败：

| 脚本 | 在空库上的结果 |
|------|------|
| V1 | 全是 `ALTER … IF EXISTS` → no-op ✅ |
| V2 | 第 9 行 `UPDATE BOOKS …` 无保护 → **BOOKS 不存在,报错** ❌ |
| V3 | `CREATE … FK REFERENCES CHAPTERS(ID)` → **CHAPTERS 不存在,报错** ❌ |
| V4 | `ALTER TABLE CHAPTERS …` 无 `IF EXISTS` → **报错** ❌ |
| V6 | FK 引用 BOOKS/CHAPTERS → **报错** ❌ |

所以链条死锁：
`V2 需要 BOOKS 存在` → `BOOKS 由 Hibernate 建` → `Hibernate 在 Flyway 之后才跑`
→ `Flyway 失败 → 启动中止 → Hibernate 永远跑不到` → **BOOKS 永远建不出来**。

> 注意：`baseline-on-migrate` **救不了空库**。Flyway 只会对"非空但缺历史表"的 schema
> 自动基线；完全空的库它会老老实实从 V1 开始跑，于是照样失败。

## 4. 解决方案（已采用）：关闭 Flyway，让 Hibernate 全权建表

`application.properties` 里设 `spring.flyway.enabled=false`。从零克隆时按下面做即可一次启动成功：

1. 确认没有 Java 进程占用数据库（`Get-CimInstance Win32_Process -Filter "Name='java.exe'"`）。
2. 删除半成品/空的库文件：`backend/data/booksdb.mv.db`、`booksdb.trace.db`。
3. 正常启动后端 → Hibernate 建出完整 schema。
   - 验证：约 4 秒内 `Started BooksCoreIdeasApplication`，`GET http://localhost:8080/api/books` 返回 `[]`。

迁移脚本文件保留，不删，仅不运行。

## 5. 可选：之后想重新启用 Flyway 做正式迁移

"关 Flyway → 删库 → Hibernate 建表 → 再开 Flyway" 这套两步自举是可行的，
**但改回 `true` 时必须同时带上 baseline 两行**，否则 Flyway 发现"有表但没历史表"会直接报
`Found non-empty schema(s) … but no schema history table`：

```properties
spring.flyway.enabled=true
spring.flyway.baseline-on-migrate=true
spring.flyway.baseline-version=0
```

这样 Flyway 会把 Hibernate 建好的 schema 认作基线版本 0，V1–V6 在已存在的表上全部安全
no-op，历史表建立，之后正常。

提醒：
- 这套开关只在"从零重建数据库"时用一次，平时不要反复切换。
- 若将来要长期用 Flyway 管理 schema，更稳妥的做法是写一个**完整的 baseline 脚本**
  （把当前全部表的 CREATE 写进去），而不是依赖这几个补丁脚本。

## 6. 如果 Flyway 开着且出现"失败的迁移记录"

症状：`Validate failed / Detected failed migration to version N`。
原因：`"flyway_schema_history"` 表里残留了一条 `success=FALSE` 的记录（H2 里表名是小写加引号）。
修复（等价于 `flyway repair`；本项目 pom 没配 flyway-maven-plugin，直接删行即可）：

```sql
DELETE FROM "flyway_schema_history" WHERE "success"=FALSE;
```

仅在没有 Java 进程占用数据库时操作。

## 7. 其它环境备忘

- **本项目用 Java 17**：`C:\Users\bob.zhu\jdk-17.0.19+10`。代理/默认 shell 的 `JAVA_HOME`
  可能指向 Java 8，会让 `mvn spring-boot:run` 报 `JVMCFRE003 bad major version`。启动前先：
  `$env:JAVA_HOME = 'C:\Users\bob.zhu\jdk-17.0.19+10'`。
- 直接用 SQL 查 H2 时用 `h2-2.2.224.jar`（库是 H2 2.2 格式）。
