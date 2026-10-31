# 02 · 后端架构与代码质量

> 范围：`backend/src/main/java/com/bookscoreideas/**`（约 60 个 Java 文件，19 个 Controller，2 个 Service）。

| ID | 优先级 | 主题 |
|---|---|---|
| BE-01 | 🟠 P1 | 缺少 Service 层，Controller 直接操作 Repository |
| BE-02 | 🟠 P1 | JPA 实体直接作为 API 出入参；`GET /api/books` 返回整棵树 |
| BE-03 | 🟡 P2 | API 响应风格不统一 |
| BE-04 | 🟠 P1 | 没有全局异常处理 |
| BE-05 | 🟡 P2 | 输入校验薄弱；枚举用裸字符串 |
| BE-06 | 🟡 P2 | 重复代码：两套导出、两处 uploadDir 初始化、两套 JSON 导入 |
| BE-07 | 🟡 P2 | 迁移导入整包读入内存 |
| BE-08 | 🟠 P1 | 迁移归档不完整（不含书评/书签/摘录批注/书单） |
| BE-09 | ⚪ P3 | 配置分环境（profile） |
| BE-10 | 🟡 P2 | Spring Boot 3.2.x 已停止 OSS 支持 |

---

<a id="be-01"></a>
## BE-01 · 缺少 Service 层 🟠

**现状**：只有 `BookCollectionService`、`MigrationService/Importer` 两个服务；其余 17 个 Controller 直接注入 Repository，业务规则（级联删除、归属校验、排序）散落在控制器里，事务边界也不一致（有的方法 `@Transactional`，有的没有，依赖 Open-Session-In-View 兜底）。

**后果**：BUG-02/03/05/08 本质上都源于"删除/更新规则没有集中地方写"。

**建议**：按聚合拆服务：`BookService`（含级联删除、删除后清图片/书单成员）、`ChapterService`、`ContentService`（ideas/excerpts）、`ReadingService`（bookmarks/marks/explanation）。Controller 只做 HTTP 映射。

> 进展：随 BUG-02/08 新增了 `BookService`（目前只有 `delete`）。

---

<a id="be-02"></a>
## BE-02 · 实体直接作为 API 出入参 🟠

**现状**：
- `Book.chapters` 没有 `@JsonIgnore`，于是 **`GET /api/books` 返回每本书的全部章节 + 全部 keyIdeas**（已实测响应中含 `"chapters":`）。书库、想法库、摘录库、书评库、阅读历史 5 个页面都调用 `bookApi.getAll()`，每次都下载整个库的内容，且每本书触发懒加载查询（N+1）。
- 入参也是实体：客户端可以提交 `id`、`chapters` 等不该由客户端控制的字段（BUG-09）。
- 实体上堆满 `@JsonIgnore` / `@Transient partId` 这类为序列化服务的注解，持久化模型和接口契约耦合。

**建议**：
1. 先做最小改动：给 `Book.chapters` 加 `@JsonIgnore`，并确认前端没有依赖列表里的 `chapters`（`LibraryPage` 之外需逐页核查）。
2. 再系统引入 `record` DTO：`BookSummaryDto`（列表）、`BookDetailDto`、`CreateBookRequest`/`UpdateBookRequest`。项目里 `dto/migration` 已经在用 record，风格可沿用。
3. 设置 `spring.jpa.open-in-view=false`，强制在服务层内完成加载，暴露隐藏的 N+1。

---

<a id="be-03"></a>
## BE-03 · API 响应风格不统一 🟡

| 风格 | 例子 |
|---|---|
| 返回实体 | `BookController`、`ChapterController`、`KeyIdeaController` |
| 返回 `Map<String,Object>` 手工拼装 | `BookReviewController`、`ReadingBookmarkController`、`ExplanationMarkController`、`BookExportController` |
| 返回 record DTO | `MigrationController`、`GlobalExcerptController` |
| 返回 class DTO | `BookCollectionController` |

删除接口有的返回 `200`，有的返回 `204`；"不存在"有的 404、有的 204（`GET explanation`）、有的 500。请求体也混用实体、`Map<String,String>`、`Map<String,Object>`。

**建议**：统一为 record DTO；约定删除返回 204、查无返回 404、校验失败 400（ProblemDetail）。可在 `doc/` 中补一份 API 约定。

---

<a id="be-04"></a>
## BE-04 · 没有全局异常处理 🟠

**现状**：无 `@RestControllerAdvice`；服务抛 `RuntimeException` → 500（BUG-07）；`MigrationController` 自己 try/catch 返回纯文本；`ChapterImageController` 吞掉 `IOException`；多处 `catch (Exception e)` 无日志。

**建议**：
- 定义 `NotFoundException`、`BadRequestException`（或直接用 `ResponseStatusException`）；
- `GlobalExceptionHandler` 统一转为 `ProblemDetail`（Spring 6 原生支持，开启 `spring.mvc.problemdetails.enabled=true`）；
- 前端 `apiFetch` 解析 `detail` 字段显示给用户（见 FE-05）。

---

<a id="be-05"></a>
## BE-05 · 输入校验薄弱；枚举用裸字符串 🟡

- `readingStatus`（`WANT_TO_READ/READING/FINISHED`）、`structureType`（`CHAPTERS/PARTS`）是任意字符串，可写入非法值；建议 Java `enum` + `@Enumerated(EnumType.STRING)`（数据库值不变，兼容）。
- `rating` 无 1–5 范围校验；`title` 等无长度上限（数据库默认 VARCHAR(255)，超长会 500）。
- `Map<String,String>` 请求体完全绕过 Bean Validation。

**建议**：DTO + `@Size/@Min/@Max/@NotBlank` + 枚举。

---

<a id="be-06"></a>
## BE-06 · 重复代码 🟡

- **两套导出**：[BookExportController](../../backend/src/main/java/com/bookscoreideas/controller/BookExportController.java)（单书 JSON）与 [MigrationService.buildBookDto](../../backend/src/main/java/com/bookscoreideas/service/MigrationService.java)（ZIP 归档）遍历同一棵树、字段各自维护，已出现差异（JSON 导出不含 explanation/images 等）。
- **两处 uploadDir 初始化**：`ChapterImageController` 与 `MigrationService` 各自 `@Value("${app.upload.dir}")` + `createDirectories`。建议抽 `@ConfigurationProperties("app")` + `ImageStorageService`（保存、读取、删除、路径穿越校验集中一处）。
  > 进展：随 BUG-03 新增了 `ChapterImageStorage`，`ChapterImageController` 已改用它；`MigrationService` / `MigrationImporter` 尚未迁移。
- **两套 JSON 导入**：前端 `LibraryPage` 与 `BookDetailPage` 各写一遍（导致 BUG-06）。

---

<a id="be-07"></a>
## BE-07 · 迁移导入整包读入内存 🟡

[MigrationService.readZip](../../backend/src/main/java/com/bookscoreideas/service/MigrationService.java) 把整个 ZIP 解压到 `Map<String, byte[]>`（上限 500MB），默认 JVM 堆下大归档可能 OOM；而 multipart 上限是 200MB。

**建议**：先把上传落到临时文件，用 `java.util.zip.ZipFile` 按需读取条目；图片直接流式写盘。

---

<a id="be-08"></a>
## BE-08 · 迁移归档不完整 🟠

ZIP 迁移只包含：书、Part、章节、keyIdeas、excerpts、explanation、章节图片。**不包含**：
- 书评 `book_reviews`
- 阅读书签 `reading_bookmarks`
- 讲解摘录批注 `explanation_marks`
- 书单 `book_collections` / `book_collection_items`

[migration-feature.md](../migration-feature.md) 也没有说明这一限制。如果把"导出 ZIP"当作备份或换机手段，这些数据会**静默丢失**。

**建议**：`FORMAT_VERSION` 升到 2，补齐以上实体（marks 依赖 explanation 文本偏移，需一并导出）；导入时兼容 v1；在文档和 UI 上明确归档范围。也可与 [DB-05 备份](03-database-and-data-safety.md#db-05) 分工：ZIP 用于"分享/迁移书"，数据库级备份用于"灾备"。

---

<a id="be-09"></a>
## BE-09 · 配置分环境 ⚪

目前只有一个 `application.properties`，dev 与 prod 共用：H2 Console 常开、devtools 依赖在 fat jar 运行时虽会自动禁用但仍打包、监听所有网卡。

**建议**：`application-dev.properties` / `application-prod.properties`；`start-prod.ps1` 传 `--spring.profiles.active=prod`。具体安全项见 [SEC-03](05-security.md#sec-03)。

---

<a id="be-10"></a>
## BE-10 · Spring Boot 3.2.x 已停止 OSS 支持 🟡

[pom.xml](../../backend/pom.xml) 使用 `spring-boot-starter-parent 3.2.5`，该版本线已过开源支持期，不再接收安全补丁（包括 Tomcat、Jackson、H2 等传递依赖）。

**建议**：升级到当前受支持的 Spring Boot 版本线（升级前先补测试，见 ENG-01）；同时引入 Maven Wrapper（ENG-04）。
