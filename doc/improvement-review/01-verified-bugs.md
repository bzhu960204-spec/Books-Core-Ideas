# 01 · 已确认的缺陷（Bugs）

> 本页只收录**已实测复现**或**代码层面可确定**的缺陷。
> 实测方式：在临时目录起一个独立 H2 库的后端（端口 18080，不触碰 `backend/data` 真实数据），用 HTTP 请求逐项复现。

| ID | 优先级 | 问题 | 验证方式 |
|---|---|---|---|
| BUG-01 | 🔴 P0 | 全新环境（空库）后端无法启动（✅ 已修复） | ✅ 实测 |
| BUG-02 | 🔴 P0 | 删除带书评的书 → 500（✅ 已修复） | ✅ 实测 |
| BUG-03 | 🔴 P0 | 删除带配图的章节（或含此类章节的书）→ 500，图片文件也不清理（✅ 已修复） | ✅ 实测 |
| BUG-04 | 🟠 P1 | 开发模式下"修改摘录批注"（PATCH）被 CORS 拦截（✅ 已修复） | ✅ 实测 |
| BUG-05 | 🟠 P1 | 子资源缺少父子归属校验，可跨章节改/删数据 | ✅ 实测 |
| BUG-06 | 🟠 P1 | 书库页 JSON 导入静默丢弃章节下的 `excerpts` | 🔍 代码确认 |
| BUG-07 | 🟡 P2 | "不存在 / 参数非法"一律返回 500 | ✅ 实测 |
| BUG-08 | 🟡 P2 | 删除书后，书单（Collection）成员行残留（✅ 已修复） | 🔍 代码确认 |
| BUG-09 | ⚪ P3 | `POST /api/books` 携带 `id` 时 500 | ✅ 实测 |
| BUG-10 | ⚪ P3 | 图片上传：序号计算偏差 & 静默吞异常 | 🔍 代码确认 |

---

<a id="bug-01"></a>
## BUG-01 · 全新环境（空库）后端无法启动 🔴

> **✅ 已修复（2026-10-31）**
> - 新增 [V0__base_schema.sql](../../backend/src/main/resources/db/migration/V0__base_schema.sql)：空库上先建核心表，V1–V7 随后全部成功；老库以版本 0 为基线，V0 状态为 `BASELINE_IGNORED`，不会执行。
> - `BookReview.content`、`ChapterExplanation.content` 补 `@Lob`，使映射与 CLOB 列一致（数据库无变化）。
> - 新增测试 `FreshDatabaseMigrationTest`、`LegacyDatabaseMigrationTest`（测试 profile 用 `ddl-auto=validate`，确保 Flyway 单独即可产生合法 schema）。
> - 在真实库副本（备份 `data-20261031-201256-before-bug01-flyway-v0.zip`）上以生产配置启动：校验 9 个迁移通过、无需迁移、24 本书 / 书评 / 讲解读写正常。
> - 重写 [database-schema-and-flyway.md](../database-schema-and-flyway.md)。

**现象**（实测日志）：
```
Migrating schema "PUBLIC" to version "2 - add parts"
Migration V2__add_parts.sql failed
Message : Table "BOOKS" not found; SQL statement:
UPDATE BOOKS SET STRUCTURE_TYPE = 'CHAPTERS' WHERE STRUCTURE_TYPE IS NULL
```

**根因**：
- [application.properties](../../backend/src/main/resources/application.properties) 第 16 行 `spring.flyway.enabled=true`，
  而 V2–V7 都是"补丁式"脚本，假定基础表已存在；Spring Boot 中 **Flyway 先于 Hibernate 执行**，空库上基础表还没建出来。
- [database-schema-and-flyway.md](../database-schema-and-flyway.md) 写的是"已采用方案：关闭 Flyway"，**文档与配置不一致**——说明某次同步把配置改回去了。

**影响**：换电脑 / 新 clone / 数据目录丢失后，应用无法启动；这也是灾难恢复路径上的单点故障。

**建议**（与 [DB-01](03-database-and-data-safety.md#db-01) 一起做）：
- 短期止血：让每个脚本在空库上也能执行（V2 的 `UPDATE`、V4 的 `ALTER` 加存在性保护），或改为 V1 先 `CREATE TABLE IF NOT EXISTS` 建出全部基础表。
- 长期：Flyway 成为 schema 唯一来源，`ddl-auto` 改为 `validate`。
- 加一个"空库启动"集成测试（见 [ENG-01](06-engineering-practices.md#eng-01)），防止回归。

---

<a id="bug-02"></a>
## BUG-02 · 删除带书评的书 → 500 🔴

> **✅ 已修复（2026-10-31）**：`Book` 新增 `reviews` 集合（`cascade=ALL, orphanRemoval`，`@JsonIgnore`，API 输出不变）；删书改走 [BookService.delete](../../backend/src/main/java/com/bookscoreideas/service/BookService.java)（单事务）。回归测试见 [DeletionCascadeTest](../../backend/src/test/java/com/bookscoreideas/deletion/DeletionCascadeTest.java)；已确认在去掉修复后对应测试会失败。

**实测**：建书 → 加一条书评 → `DELETE /api/books/{id}` 返回 **500**：
```
Referential integrity constraint violation: "FKCM2SHIVX19SPBG0FLC47MCRS1:
PUBLIC.BOOK_REVIEWS FOREIGN KEY(BOOK_ID) REFERENCES PUBLIC.BOOKS(ID)"
```

**根因**：[Book.java](../../backend/src/main/java/com/bookscoreideas/entity/Book.java) 只级联了 `chapters` 和 `parts`，没有 `reviews`；[BookController.deleteBook](../../backend/src/main/java/com/bookscoreideas/controller/BookController.java) 直接 `delete(book)`。

**建议**：在 `Book` 上加 `@OneToMany(mappedBy="book", cascade=ALL, orphanRemoval=true) @JsonIgnore List<BookReview> reviews`，或在删除服务里显式先删书评；同时补数据库层 `ON DELETE CASCADE`（见 [DB-02](03-database-and-data-safety.md#db-02)）。

---

<a id="bug-03"></a>
## BUG-03 · 删除带配图的章节 → 500，图片文件不清理 🔴

> **✅ 已修复（2026-10-31）**
> - `Chapter` 新增 `images` 集合（级联删除），删除章节 / Part / 书都不再被 `chapter_images` 外键阻塞。
> - 新增 [ChapterImageStorage](../../backend/src/main/java/com/bookscoreideas/service/ChapterImageStorage.java)（图片目录、安全路径解析、**提交后删除文件**）与 JPA 监听器 [ChapterImageFileCleanup](../../backend/src/main/java/com/bookscoreideas/service/ChapterImageFileCleanup.java)：任何路径删除 `ChapterImage`（直接删、级联删）都会在事务提交后删除对应文件，回滚则保留文件。
> - `ChapterImageController.deleteImage` 原先"先删文件、再删记录"，现在统一交给监听器处理。
> - 测试覆盖：删章节、删 Part、删单张图片、删完整的书（含 Part/章节/想法/摘录/讲解/书签/标记/书评/图片/书单），均断言记录与文件都已删除。
> - 真实库副本检查：无历史孤儿图片记录。**另发现**：数据库中有 5 条图片记录，但本机 `backend/data/images/` 为空（文件可能只在另一台机器 / OneDrive 上），这些图片在本机无法显示——与本修复无关，需确认图片的同步方式。
> - "孤儿图片文件清理"维护任务暂未实现。

**实测**：建章节 → 上传 1 张图片 → `DELETE /api/books/{bookId}/chapters/{chapterId}` 返回 **500**（FK 冲突）。删除整本书时同样会走到这条级联链而失败。

**根因**：[ChapterImage](../../backend/src/main/java/com/bookscoreideas/entity/ChapterImage.java) 有到章节的外键，但 [Chapter.java](../../backend/src/main/java/com/bookscoreideas/entity/Chapter.java) 没有 `images` 集合与级联；即使删成功，磁盘上的图片文件也没有任何清理逻辑。

**建议**：
- `Chapter` 增加 `images` 集合并级联删除；
- 在删除章节/书的服务方法中，**事务提交后**删除对应图片文件（`TransactionSynchronization.afterCommit`）；
- 提供一个"孤儿图片清理"维护任务（扫描 `data/images` 中数据库已不引用的文件）。

---

<a id="bug-04"></a>
## BUG-04 · 开发模式下 PATCH 被 CORS 拦截 🟠

> **✅ 已修复（2026-10-31）**，两项都做了：
> - [WebConfig](../../backend/src/main/java/com/bookscoreideas/config/WebConfig.java) 的 `allowedMethods` 补上 `PATCH`；回归测试 [CorsConfigTest](../../backend/src/test/java/com/bookscoreideas/config/CorsConfigTest.java)（5 个方法的预检都允许、非白名单 Origin 被拒绝；已确认修复前 PATCH 用例失败）。
> - 开发模式改为同源：[vite.config.js](../../frontend/vite.config.js) 把 `/api` 代理到后端（`VITE_API_PROXY_TARGET`，默认 `http://localhost:8080`）；[api.js](../../frontend/src/api.js) 默认 `API_BASE` 改为 `/api`；`start-dev.ps1` 改为设置代理目标，不再设置 `VITE_API_BASE`。生产构建（`VITE_API_BASE=/api`）不受影响。
> - 端到端验证：临时库后端 + Vite 代理，在浏览器中打开书详情页并编辑"已保存段落"的批注（PATCH），已写入后端；图片上传/读取经代理正常。

**实测**：`OPTIONS /api/marks/1` + `Access-Control-Request-Method: PATCH` → **403**；同样的 PUT → 200。

**根因**：[WebConfig.java](../../backend/src/main/java/com/bookscoreideas/config/WebConfig.java) 第 22 行 `allowedMethods("GET","POST","PUT","DELETE")` 缺 `PATCH`，而前端 [api.js](../../frontend/src/api.js) `markApi.updateNote` 使用 `PATCH`。
生产模式（单端口、同源）不受影响，所以这个问题只在 `start-dev` 下出现，容易被忽略。

**建议**：加上 `"PATCH"`；或者在 Vite 配置 `server.proxy` 把 `/api` 代理到后端，开发模式也同源，彻底消除开发/生产差异。

---

<a id="bug-05"></a>
## BUG-05 · 子资源缺少父子归属校验 🟠

**实测**：
- 想法 #2 属于章节 C2；`PUT /api/chapters/{C3}/ideas/2` 把它改成了 `"HIJACKED"` —— **成功**；
- `DELETE /api/chapters/{C3}/ideas/{属于C2的想法}` —— **成功删除**。

**根因**：各控制器只检查"父资源存在"，不检查"子资源属于这个父资源"。涉及：
[KeyIdeaController](../../backend/src/main/java/com/bookscoreideas/controller/KeyIdeaController.java)、
[ExcerptController](../../backend/src/main/java/com/bookscoreideas/controller/ExcerptController.java)、
[ChapterController](../../backend/src/main/java/com/bookscoreideas/controller/ChapterController.java)、
[PartController](../../backend/src/main/java/com/bookscoreideas/controller/PartController.java)、
[ChapterImageController](../../backend/src/main/java/com/bookscoreideas/controller/ChapterImageController.java)（图片读取/删除完全不看 `chapterId`）。
另外 `ChapterController.applyPart` 不校验 `partId` 是否属于同一本书，可把章节挂到别的书的 Part 下。

**影响**：单用户本地应用里主要是**数据完整性**风险（前端 bug 或传错 id 就会改错数据），而不是越权。

**建议**：仓库增加 `findByIdAndChapterId(...)` / `findByIdAndBookId(...)`，查不到即 404。`BookReviewController` 已经这么做了，可作为模板。

---

<a id="bug-06"></a>
## BUG-06 · 书库页 JSON 导入静默丢弃 `excerpts` 🟠

**根因**：[LibraryPage.jsx](../../frontend/src/pages/LibraryPage.jsx) 的 `handleJsonImport` 只处理 `keyIdeas`，`excerpts` 被留在 `chapterFields` 里发给后端，而 [Chapter.excerpts](../../backend/src/main/java/com/bookscoreideas/entity/Chapter.java) 带 `@JsonIgnore`，于是被丢弃。
但 [README](../../README.md) 的 "Full — with nested chapters, key ideas, and excerpts" 示例明确声称支持。书详情页的导入（[BookDetailPage.jsx](../../frontend/src/pages/BookDetailPage.jsx) 第 541、583 行）是正确处理 excerpts 的——**两处导入逻辑重复且不一致**。

**建议**：短期补上 excerpts；长期把 JSON 导入移到后端单一事务接口（见 [FE-08](04-frontend.md#fe-08)）。

---

<a id="bug-07"></a>
## BUG-07 · "不存在 / 参数非法"一律 500 🟡

**实测**：`GET /api/book-collections/999/books` → **500**。

**根因**：[BookCollectionService](../../backend/src/main/java/com/bookscoreideas/service/BookCollectionService.java) 第 52、128 行抛 `RuntimeException`；`IllegalArgumentException`（如"不能移动到自己的子目录"）也没有映射；项目中没有 `@RestControllerAdvice`。
前端拿到的是一大段 Spring 默认错误 JSON，无法给出友好提示。

**建议**：见 [BE-04](02-backend-architecture.md#be-04)：自定义 `NotFoundException` / `BadRequestException` + 全局异常处理，统一返回 `ProblemDetail`。

---

<a id="bug-08"></a>
## BUG-08 · 删除书后书单成员行残留 🟡

> **✅ 已修复（2026-10-31）**：`BookService.delete` 在同一事务内调用 `deleteByBookId` 清除成员行；真实库副本中无历史孤儿行，无需数据清理。数据库层外键/级联留待 DB-02。

[BookCollectionService.directMemberCounts](../../backend/src/main/java/com/bookscoreideas/service/BookCollectionService.java) 的注释已承认："Deleting a book does not remove its membership rows"，目前靠查询时过滤来"掩盖"。
仓库里其实已经有 `BookCollectionItemRepository.deleteByBookId`，但**从未被调用**。

**建议**：删书时调用 `deleteByBookId`；`book_collection_items.book_id` 加外键 + `ON DELETE CASCADE`。

---

<a id="bug-09"></a>
## BUG-09 · `POST /api/books` 携带 `id` → 500 ⚪

**实测**：请求体带已存在的 `id` 时返回 500（没有覆盖数据，但应当被忽略或返回 400）。根因是控制器直接把请求体绑定到 JPA 实体并 `save()`（变成 merge）。随 [BE-02](02-backend-architecture.md#be-02) 引入请求 DTO 后自然消失。

---

<a id="bug-10"></a>
## BUG-10 · 图片上传：序号偏差 & 静默吞异常 ⚪

[ChapterImageController.uploadImages](../../backend/src/main/java/com/bookscoreideas/controller/ChapterImageController.java)：
- `orderIndex = currentCount + i + 1` 用的是循环下标，被跳过的文件（空文件 / 非图片）会造成序号空洞；
- `catch (IOException e) { /* skip */ }` 没有日志，也不告诉前端哪个文件失败了。

**建议**：用"已保存数"计数；记录日志并在响应中返回失败列表。
