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
>
> **✅ BE-01 已完成（2026-10-31）**，按决定与 BE-03 的"DTO 化"合并做，**JSON 字段保持不变**。每一步都用真实数据副本采集全部 2,695 个 GET 响应，与改动前的基线逐条对比：
> - ① 章节与 Part：`ChapterService` / `PartService`，`ChapterDto`（含 `KeyIdeaDto` 列表）/ `PartDto`。`GET /books/{id}/chapters` 原来每个章节要额外查 2 次：想法 1 次；讲解 1 次，因为 `Chapter.explanation` 是反向一对一，没有字节码增强就无法懒加载。现在改为"投影查询章节 + 一次批量查询想法"，**固定 2 条 SQL**。测试 [ChapterApiTest](../../backend/src/test/java/com/bookscoreideas/books/ChapterApiTest.java)（6 个，N+1 用例改动前失败）；真实数据对比 2,695 个响应零差异。
> - 发现并单独修复了 **BUG-13**（子资源新建时带 `id` 会覆盖并挪走已有数据）。
> - ② 想法与摘录：`KeyIdeaService` / `ExcerptService`（同时负责想法库、摘录库的全局搜索），`ExcerptDto`。测试 [ContentApiTest](../../backend/src/test/java/com/bookscoreideas/books/ContentApiTest.java)（4 个，改动前后都通过）；真实数据对比 2,695 个响应零差异。
> - ③ 阅读相关：`ExplanationService` / `ReviewService` / `BookmarkService` / `MarkService`，`ExplanationDto` / `ReviewDto` / `ReviewBankEntryDto` / `BookmarkDto` / `MarkDto` 取代手工拼装的 `Map`（空值兜底规则不变）。请求体的宽松解析（`Map` + `instanceof Number`）暂时保留在控制器里，留给 BE-05。书签列表和片段收藏列表原来每行都要单独加载章节（连带讲解）和书，现在改为一条投影查询；书评库用 `JOIN FETCH` 取书。讲解、书评、片段收藏的更新改用 `saveAndFlush`，确保响应里的 `updatedAt` 是新值：讲解和书评原本就是这样，挪进事务后要显式 flush 才能保持；片段收藏的 PATCH 原来返回旧值，现在也返回新值。测试 [ReadingApiTest](../../backend/src/test/java/com/bookscoreideas/books/ReadingApiTest.java)（5 个：4 个特征测试改动前后都通过，N+1 用例改动前失败；把 `saveAndFlush` 换回 `save` 会让 2 个用例失败）；真实数据对比 2,695 个响应零差异。
> - ④ 章节图片 + BE-06 图片存储统一：`ChapterImageService`、`ChapterImageDto`。路径校验、写入、读取全部集中到 `ChapterImageStorage`（新增 `existing`/`store`/`write`），`MigrationService` 不再自己读取 `app.upload.dir`，改用它；配置项现在只在一处读取。上传行为保持原样（序号偏差和静默跳过 IO 异常属于 BUG-10，留到阶段 4）。唯一的细微差别：数据库中文件名非法时，原来返回 400，现在和"文件不存在"一样返回 404（文件名由服务端生成 UUID，正常情况下不会出现）。测试 [ImageApiTest](../../backend/src/test/java/com/bookscoreideas/books/ImageApiTest.java)（3 个，改动前后都通过），其中包括**迁移导出 → 删除 → 导入后图片字节一致**的往返测试（迁移功能此前没有任何测试）；真实数据对比 2,695 个响应零差异。
> - ⑤ 收尾：单书 JSON 导出原样搬进 `BookExportService`（格式留给 BE-08）；分类查询移进 `BookService`。**现在所有控制器都不再直接注入 Repository。** 迁移导出加上只读事务（它在 `StreamingResponseBody` 的异步线程里执行，以前靠 OSIV 的异步绑定）。设置 **`spring.jpa.open-in-view=false`**，并用 [OpenInViewDisabledTest](../../backend/src/test/java/com/bookscoreideas/config/OpenInViewDisabledTest.java) 锁定（强制打开 OSIV 时该测试失败）；全部 62 个后端测试在 OSIV 关闭下通过。真实数据验证：2,695 个响应零差异；整库迁移导出 ZIP 与上一个提交（OSIV 开启）导出的 25 个条目逐字节一致（不计导出时间戳）；浏览器中 8 个页面和讲解阅读窗口正常，后端日志无异常。
> - ~~留给 DB-06：其他地方加载 `Chapter` 实体时仍会顺带加载讲解（大字段），可以考虑把这个反向一对一去掉，改由服务层负责级联删除。~~ ✅ 已在 DB-06 中完成：去掉反向一对一，删除改由数据库级联（V9）负责，见 [DB-06](03-database-and-data-safety.md#db-06)。
> - 留给 BE-05：请求体的 `Map` 宽松解析（书签、片段收藏、讲解、书评）改为带校验的请求 record。
> - ~~留给 BE-03（契约变更，需配合前端）：DELETE 返回 200 还是 204、查无时返回 204 还是 404、POST 是否返回 201，目前仍和原来一样不统一。~~ ✅ 已在 BE-03 中统一（见 [api-conventions.md](../api-conventions.md)）。

---

<a id="be-02"></a>
## BE-02 · 实体直接作为 API 出入参 🟠

> **✅ 已完成（2026-10-31，范围限于 `/api/books`，其他资源留给 BE-03）**，分 2 个提交：
> 1. `ae796a8` 请求 DTO：[CreateBookRequest](../../backend/src/main/java/com/bookscoreideas/dto/CreateBookRequest.java) / [UpdateBookRequest](../../backend/src/main/java/com/bookscoreideas/dto/UpdateBookRequest.java)，映射移到 [BookService](../../backend/src/main/java/com/bookscoreideas/service/BookService.java)，顺带修复 **BUG-09**（实为静默覆盖，严重度上调）。
> 2. 响应 DTO：列表、详情、新建、更新以及书单的 `/book-collections/{id}/books` 统一返回 [BookDto](../../backend/src/main/java/com/bookscoreideas/dto/BookDto.java)，即**全部标量字段 + `chapterCount`**，不再带 `chapters`。保留全部标量字段是因为前端会用 `{...book, rating}` 整体回传给 PUT。最初计划拆成 Summary/Detail 两个 DTO，但两者字段完全相同，于是合成一个。`chapterCount` 用一条 `GROUP BY` 查询算出。前端 3 处 `book.chapters?.length` 改为 `book.chapterCount`。
> - **效果**（备份库副本，24 本书 / 479 章 / 1285 条想法）：`GET /api/books` 响应体从 **757,737 → 25,637 字节（−97%）**，预热后耗时 **约 800 → 44 ms**；SQL 条数不再随书本数量增长。
> - **一致性**：对比改动前后共 29 个响应文件、56 个书籍对象，除 `chapters` → `chapterCount` 外**零差异**；界面上 24 本书显示的章节数与旧数据逐本一致。浏览器验证：在书库改评分、在详情页改阅读状态，PUT 往返后只有目标字段变化（描述等字段不丢失）；书单视图、按 Part 组织的书的详情页均正常。
> - 测试：[BookRequestTest](../../backend/src/test/java/com/bookscoreideas/books/BookRequestTest.java)（5 个）、[BookResponseTest](../../backend/src/test/java/com/bookscoreideas/books/BookResponseTest.java)（6 个，其中 N+1 回归用 Hibernate statistics 统计 SQL 条数；改动前 5 个失败，"列表回传 PUT 不丢字段"这个保护用例前后都通过）。
> - 未做（按决定推迟）：`spring.jpa.open-in-view=false` 推迟到 BE-01（**已随 BE-01 ⑤ 完成**）；状态码统一留给 BE-03；`Book` 实体上的 `chapters` 集合仍保留（用于级联删除），只是不再出现在 API 中。

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

> **✅ 已完成（2026-10-31）**：约定写在 [api-conventions.md](../api-conventions.md)。响应 DTO 化随 BE-01 完成，请求体 record 化随 BE-05 完成；这次统一状态码和错误格式。用户授权"按最佳判断"，决定如下：
> 1. **删除 → 204**：书、章节、Part、想法、摘录、图片原来返回 200。
> 2. **新建 → 201**：书、章节、Part、想法、摘录、书评、书签、标记、书单、图片上传。不带 `Location`，因为多数子资源没有单独的 GET。导入导出返回报告或文件，仍为 200；"把书加入书单"是建立关联，仍为 204。
> 3. **父资源不存在 → 404**：原来是 200 `[]`，讲解和最近书签原来是 204。涉及 12 个嵌套读取接口，由服务层用 `NotFoundException.requireExists` 检查。
> 4. **可选的单个资源为空 → 仍为 204**：章节没有讲解、书没有书签。这是正常状态，不是错误，前端依赖它返回 null。
> 5. **查询参数筛选**（`/ideas?bookId=` 等）**仍返回 200 `[]`**：筛选条件不是父资源。
> 6. **所有错误都是 ProblemDetail**：
>    - 迁移接口原来返回纯文本 400，现在交给全局异常处理；
>    - `ResponseEntity.of` / `notFound()` 原来返回空体的 404，现在一律经 [Responses](../../backend/src/main/java/com/bookscoreideas/web/Responses.java) 抛出 `NotFoundException`，404 都带 `detail`，例如 "Chapter not found: 5"。
> - **前端无需改动**：`apiFetch` 只看 `res.ok`，对 204、200 空体、201 的处理相同；`errorMessage()` 早已能解析 ProblemDetail。
> - **测试**：
>   - [ApiConventionsTest](../../backend/src/test/java/com/bookscoreideas/web/ApiConventionsTest.java)，28 个：在 HEAD 上运行有 24 个失败，4 个特征用例（可选资源 204、查询筛选 200 `[]`）前后都通过。
>   - 原有测试中断言旧状态码的 17 处已按新约定逐一修改，例如 `unknownBookListsNothing` 改为 `unknownBookIs404`。
> - **真实数据 / 浏览器验证**：
>   - GET 对比：2,724 个响应中只有 5 个不同，都是"图片文件不存在"的 404，响应体由空变为 ProblemDetail。
>   - 浏览器（真实数据副本 + Vite 15173）中依次操作：新建 Part（201）→ 新建章节（201）→ 打开没有讲解的章节（204，编辑器为空）→ 保存讲解（200，标记 ✓）→ 标记读到这里（201，"继续阅读"出现）→ 删除讲解 / 章节 / Part（204，界面同步更新，"继续阅读"消失）→ 新建书单（201）。
>   - 不存在的书 `/book/999999` 仍显示 "Book not found"。书库、阅读历史等页面正常。
>   - 浏览器工具会把经 Vite 代理的 204 响应记为 `ERR_ABORTED`。HEAD 中已有的 204 接口也是这样；`fetch` 正常返回，界面也正确更新。

---

<a id="be-04"></a>
## BE-04 · 没有全局异常处理 🟠

> **✅ 已完成（2026-10-31）**
> - [GlobalExceptionHandler](../../backend/src/main/java/com/bookscoreideas/web/GlobalExceptionHandler.java)（继承 `ResponseEntityExceptionHandler`）：`NotFoundException`→404、`IllegalArgumentException`→400、`DataIntegrityViolationException`→409、其他异常→500（只返回通用提示，详情写日志）；Spring MVC 自身的错误（校验、JSON 格式、未知路由等）由基类处理。全部返回 `application/problem+json`。
> - 校验失败时 `detail` 列出具体字段（如 `title: must not be blank`），替代 Spring 默认的 "Invalid request content."。
> - 前端 [api.js](../../frontend/src/api.js) 新增 `errorMessage()`：优先取 ProblemDetail 的 `detail`，兼容纯文本错误（迁移接口仍返回纯文本）。在浏览器中导入真实 `api.js` 验证了 404 / 400 / 校验 / 迁移纯文本各类错误信息均可读。
> - 尚未处理：~~`MigrationController` 自己 try/catch 返回纯文本~~（✅ 随 BE-03 改为 ProblemDetail）、`ChapterImageController` 吞掉 `IOException`（见 BUG-10）。

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

> **✅ 已完成（2026-10-31，枚举映射除外）**
> - **校验**：所有写接口的请求体都做 Bean Validation，失败时返回 400 ProblemDetail，`detail` 中写明字段名。
>   - 文本长度按数据库列宽：书名/作者/ISBN/封面/分类 255，简介 2000，章节和 Part 标题 255，Part 摘要 1000，想法正文/例子 3000、标签 500，摘录批注 1000、出处 300，书评标题 255，书签批注 500。
>   - 评分只能为 1–5 或空。
>   - `readingStatus` 只能为 `WANT_TO_READ` / `READING` / `FINISHED` / 空串 / null；`structureType` 只能为 `CHAPTERS` / `PARTS`。允许的值集中在 [BookValues](../../backend/src/main/java/com/bookscoreideas/dto/BookValues.java)。
> - **改动前的问题**：超长文本一路写到数据库，"value too long"被当成 **409 冲突**返回；评分 6 会被保存，而书库页按 `5 - rating` 画空心星，`'★'.repeat(-1)` 会让**页面崩溃**；任意状态值都能写入。
> - **类型错误**（例如 `scrollRatio: "half"`）原来返回笼统的 "Failed to read request"，现在写明字段：`scrollRatio: must be a valid Double`。
> - **`Map` 请求体全部换成带校验的 record**：书评 `ReviewRequest`、讲解 `ExplanationRequest`、书签 `BookmarkRequest`、标记 `MarkRequest` / `MarkNoteRequest`。
>   - 标记的上下文和批注仍然是**截断而不拒绝**：上下文是从页面上截取的，长度不由读者决定（行为不变）。
>   - 书评更新时 null 表示"不改"，与原来"缺省表示不改"一致；界面总是同时发送两个字段。
> - **契约变化**：`scrollRatio` 不是数字时由"静默存为空"改为 400。前端只会发送数字或 null；`ReadingApiTest` 中的对应用例已改为"缺省"。
> - **未做：Java 枚举映射**。真实库中有 13 本书的 `reading_status` 是空串、4 本是 NULL，直接映射为 `@Enumerated` 会在加载时报错。需要先迁移数据（`''` → NULL），这会改变这 13 本书在 API 中的输出，所以暂缓，目前用请求校验保证新写入的值合法。
> - 书单请求体 `BookCollectionRequest` 未改：服务层已对名称做校验并返回 400。
> - **测试**：[InputValidationTest](../../backend/src/test/java/com/bookscoreideas/web/InputValidationTest.java)，参数化 36 个：27 个非法输入改动前全部失败（409 / 200 / 空 400），9 个边界值改动前后都通过。
> - **真实数据**：
>   - 2,724 个 GET 响应零差异。
>   - 在副本上把现有的 24 本书、16 个 Part、479 章、1,285 条想法、932 条摘录、5 条书评**原样 PUT 回去**，全部通过新校验，即现有数据都还能编辑。新旧代码执行同样的回写后，两边状态零差异。其中 2 条标题为 NULL 的书评会变成空串并更新日期，这是读取 DTO 把 null 显示为 `""` 造成的，旧代码同样如此，与本次无关。

---

<a id="be-06"></a>
## BE-06 · 重复代码 🟡

- **两套导出**：[BookExportController](../../backend/src/main/java/com/bookscoreideas/controller/BookExportController.java)（单书 JSON）与 [MigrationService.buildBookDto](../../backend/src/main/java/com/bookscoreideas/service/MigrationService.java)（ZIP 归档）遍历同一棵树、字段各自维护，已出现差异（JSON 导出不含 explanation/images 等）。
- **两处 uploadDir 初始化**：`ChapterImageController` 与 `MigrationService` 各自 `@Value("${app.upload.dir}")` + `createDirectories`。建议抽 `@ConfigurationProperties("app")` + `ImageStorageService`（保存、读取、删除、路径穿越校验集中一处）。
  > 进展：随 BUG-03 新增了 `ChapterImageStorage`，`ChapterImageController` 已改用它；`MigrationService` / `MigrationImporter` 尚未迁移。
  > **✅ 图片存储部分已完成（2026-10-31，随 BE-01 ④）**：`MigrationService` 也改用 `ChapterImageStorage`，`app.upload.dir` 只在一处读取。"两套导出"按决定推迟到 BE-08（迁移归档 v2）一起设计；"两套 JSON 导入"属于前端，随 FE-08 / BUG-06 处理。
  > **✅ 两套导出已统一（2026-10-31，随 BE-08）**：两者共用 `BookArchiveBuilder` 读取书籍树。单本 JSON 导出是 JSON 导入格式，输出保持逐字节不变（`BookJsonExportTest`）。
- **两套 JSON 导入**：前端 `LibraryPage` 与 `BookDetailPage` 各写一遍（导致 BUG-06）。
  > **后端部分已完成（2026-11-01，随 FE-08 ①）**：JSON 导入移到后端 `JsonImportService`。它和 ZIP 迁移共用新抽出的 `BookTreeWriter`，书库导入直接复用 `MigrationImporter.persistBook`，所以创建这些行的代码只有一处。前端的两份导入循环在 FE-08 ② 中删除。
  > **✅ 全部完成（2026-11-01，随 FE-08 ②）**：前端两份导入循环已删除，请求体由共用的 `utils/jsonImport.js` 生成。

---

<a id="be-07"></a>
## BE-07 · 迁移导入整包读入内存 🟡

[MigrationService.readZip](../../backend/src/main/java/com/bookscoreideas/service/MigrationService.java) 把整个 ZIP 解压到 `Map<String, byte[]>`（上限 500MB），默认 JVM 堆下大归档可能 OOM；而 multipart 上限是 200MB。

> 随 [SEC-04](05-security.md#sec-04) 移交过来：图片文件在每本书的事务**提交后**才写盘。写盘失败时，这本书报告为 FAILED，但数据库里已经有了，而且再次导入会因同名被跳过。改为流式写盘时，一并改成"在事务中写盘，回滚就删除"（BUG-10 的 `ChapterImageStorage.deleteIfRolledBack`）。

**建议**：先把上传落到临时文件，用 `java.util.zip.ZipFile` 按需读取条目；图片直接流式写盘。

> **✅ 已完成（2026-11-01）**：导入和预览不再把归档读进内存；图片在每本书的事务中写盘，回滚就删除。接口和报告格式不变。
>
> **设计决定**（简单项，按最佳判断）
> 1. **临时文件由控制器负责**：[MigrationController](../../backend/src/main/java/com/bookscoreideas/controller/MigrationController.java) 把上传 `transferTo` 到系统临时目录的 `bci-migration-*.zip`，处理完在 `finally` 中删除（包括 400 的情况）。Tomcat 本来就把 multipart 写在磁盘上，`transferTo(File)` 通常只是移动文件。服务层改为接收 `Path`，不依赖 Web 类型。
> 2. **`ZipFile` 按需读取**：[MigrationService](../../backend/src/main/java/com/bookscoreideas/service/MigrationService.java) 的 `Archive` 按中央目录建立索引，只把 `manifest.json` 和当前这本书的 `book.json` 读进内存；预览完全不打开图片。条目名同样把 `\` 换成 `/`，图片仍按 `<book.json 所在目录>/images/<filename>` 精确查找，不做路径解析。
> 3. **zip bomb 防护保持等效**：原来是"累计读出的字节"超过 500 MB 就拒绝。现在条目按需读取，所以改为两步：
>    - 打开时检查条目数（50,000）和各条目**声明的**解压大小之和（500 MB），超限照旧返回 400 "Archive is too large to import."，一本书都不会导入。原来也是整个归档被拒绝。
>    - 读取时，任何条目读出的字节都不能超过它声明的大小，否则报错 "…is larger than its declared size; the archive is corrupt."。所以实际读出的总量不会超过 500 MB，谎报大小的归档也拦得住。这样的条目会让所在的书导入失败（`FAILED`），其他书照常导入。
> 4. **在事务中写盘，回滚就删除**（SEC-04 移交）：[BookTreeWriter](../../backend/src/main/java/com/bookscoreideas/service/BookTreeWriter.java) 读文件头判断类型，然后把条目流式写入图片目录，再保存图片行。写入**之前**就登记 `deleteIfRolledBack`，所以写到一半的文件也会在回滚时删掉。`PendingImageWrite` 和 `ChapterImageStorage.write(byte[])` 已删除。
> 5. **写盘失败时整本书失败**，而不是像上传那样只跳过这张图片：本书回滚，已写的文件删除，报告 `FAILED`，`message` 为 "Import failed: Could not import image b.png: disk full"，并记录警告日志。理由：只跳过的话，会留下一本缺图片的书，而且这本书会因"同名已存在"挡住重新导入；整本失败则可以在处理好磁盘问题后直接重新导入。上传是用户当场选的文件，跳过并报告更合适，所以两者不同。
> 6. 不是 ZIP 的文件仍然返回 "Not a valid migration archive: manifest.json is missing."，与原来相同（`ZipFile` 打开失败时给出同样的答复）。
>
> **测试** [MigrationImportFilesTest](../../backend/src/test/java/com/bookscoreideas/migration/MigrationImportFilesTest.java)（5 个）：
> - 回归：一个归档两本书，第一本的第二张图片写到一半时抛出 "disk full"。断言第一本 `FAILED`、消息写明图片和原因、**数据库中没有这本书**、没有留下文件，第二本正常导入。修复前失败：书报告为 `FAILED`，却已经在书库里（当时用同样的方式模拟 `write`）。
> - 书在图片写完后才失败（书单路径为空，书单在章节之后写入）：书不入库，已写的两张图片都被删除。修复前也通过（那时还没写文件），用来守住新的写盘时机。
> - 条目实际解压出的字节多于声明的大小（改写中央目录中的大小）：这本书 `FAILED`，没有留下文件。修复前会正常导入。
> - 声明的总大小超过 500 MB：预览和导入都返回 400，一本书都不导入。修复前会导入。
> - 预览、导入和 400 之后，临时目录里都不留下 `bci-migration-*` 文件。
> - 原有的迁移测试（`MigrationArchiveTest`、`MigrationImageSafetyTest`、`ImageApiTest`、`ApiConventionsTest` 中的错误格式、`JsonImportApiTest`）改动前后都通过。后端共 200 个测试通过。
>
> **验证**
> - 真实数据副本：改动前后 2,748 个 GET 响应零差异，各表不变。
> - 往返（`roundtrip.py`，真实数据副本 → 空库）：改动前后结果相同。ZIP 导入 24 本全部成功，JSON 导入 24 本往返完全相同，只有 book 195 的已知差异（5 张图片的文件不在本机）。
> - 内存：生成一个 180 MB 的归档（60 张 3 MB 的不可压缩"PNG"），两个版本都用 `-Xmx160m` 在空库上启动，用 curl 先预览再导入。改动前两次都是 500（日志中 `OutOfMemoryError`），一个文件都没写；改动后预览 1 秒、导入 5 秒，都是 200，60 张图片全部写入，没有 OOM。之后临时目录中没有残留文件。
> - 前端没有改动，接口不变，所以没有做浏览器验证；真实 Tomcat 的 multipart（`transferTo`）已由上面的 curl 覆盖。

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

> **✅ 已完成（2026-10-31）**：归档格式 v2。用户授权"按最佳判断"，所做选择及理由如下。
>
> **设计决定**
> 1. **数据放在所属位置**：书评放在书级 `reviews`；书签、标记放在章节的 `bookmarks` / `marks` 中，和标记偏移量所指向的 `explanation` 正文在一起。
> 2. **书单用名称路径**（`collectionPaths: [["心理学","习惯"]]`），不用 ID，因为 ID 在另一套部署里没有意义。导入时用新增的 `BookCollectionService.findOrCreatePath` 按路径查找或新建，**合并**进现有的树。不导出空书单、书单排序和加入时间，也就是只覆盖"书在哪些书单里"。
> 3. **保留原始时间戳**：书签的 `createdAt` 决定阅读历史时间线的顺序，属于数据本身。v1 其实已经导出了讲解的 `updatedAt`，但导入时被 `@PrePersist` 覆盖成当天；现在 `BookReview` / `ChapterExplanation` 的 `@PrePersist` 只在为空时填"现在"，修改时仍由 `@PreUpdate` 更新。
> 4. **版本检查**：v1 归档照常导入（缺少的部分为空）；**更新版本的归档返回 400**。原来完全不检查版本，新格式会被"导入成功"，但新增内容被悄悄丢掉。
> 5. **两套导出（BE-06）**：单本 JSON 导出同时也是 README 中记录的、可手工编辑的 **JSON 导入格式**，所以**输出保持不变**。它与 ZIP 迁移共用新的 [BookArchiveBuilder](../../backend/src/main/java/com/bookscoreideas/service/BookArchiveBuilder.java)，后者是唯一遍历书籍树的地方；JSON 导出只是把快照映射成导入格式。
> 6. 列表按创建顺序（ID 升序）导出，导入后相对顺序不变，因此"导出 → 导入 → 再导出"的结果完全相同。
> 7. 前端：迁移弹窗的说明文字写明了归档范围；导入预览会显示书评、书签、标记、书单的数量（仅在非零时显示）。
>
> **测试**
> - [MigrationArchiveTest](../../backend/src/test/java/com/bookscoreideas/migration/MigrationArchiveTest.java)：4 个，改动前全部失败。
>   - 往返：再导出与原导出**完全相同**，并显式检查时间戳和书单（删掉的子书单会被重建，根书单不重复）；
>   - v1 兼容；
>   - 拒绝 v3；
>   - 预览计数。
> - [BookJsonExportTest](../../backend/src/test/java/com/bookscoreideas/books/BookJsonExportTest.java)：3 个，特征测试，锁定逐字节输出，改动前后都通过。
> - 前端：`migrationPreview.test.js`，以及 `BookMigrationModal.test.jsx`（改动前失败）。
>
> **真实数据验证**
> - 2,724 个 GET 响应中，只有 24 个迁移 ZIP 导出不同，且全部是**纯新增**：去掉 v2 新字段、把版本号改回 1 后与改动前逐字节相同；新增内容为 5 条书评、1 个书签、4 条书单成员。
> - 整库往返：从真实库副本导出全部 24 本书，导入一个全新的空库，再全部导出。25 个 JSON 条目**全部相同**（1,285 条想法、932 条摘录、51 篇讲解、书评、书签、书单路径及时间戳）。唯一的差别是 book 195 的 5 条图片记录：它们的文件本来就不在 `backend/data/images/` 中（见 [development-workflow.md](../development-workflow.md#7-已知的数据现状2026-10-31)），导入时因没有文件而跳过。

---

<a id="be-09"></a>
## BE-09 · 配置分环境 ⚪

目前只有一个 `application.properties`，dev 与 prod 共用：H2 Console 常开、devtools 依赖在 fat jar 运行时虽会自动禁用但仍打包、监听所有网卡。

> **✅ 已完成（2026-11-01）**：默认配置就是安全配置，开发工具需要显式开启。
>
> **设计决定**（用户确认）
> 1. **默认配置即安全配置**。[application.properties](../../backend/src/main/resources/application.properties) 只放各环境共用、单独运行也安全的设置：不开 H2 Console、不允许跨域。不带 profile 运行（`java -jar`、IDE 启动、验证工具）时，不会带上开发工具。
>    - 新增 [application-dev.properties](../../backend/src/main/resources/application-dev.properties)，只开 H2 Console；[start-dev.ps1](../../start-dev.ps1) 设置 `SPRING_PROFILES_ACTIVE=dev`。
>    - [application-prod.properties](../../backend/src/main/resources/application-prod.properties)（SEC-03 中建立）仍然明确关闭 Console，这样即使和 dev 同时启用（`dev,prod`），prod 也会胜出。
>    - test profile 不变。
> 2. **CORS 默认关闭**。自 BUG-04 起，dev（Vite 代理）和 prod（单端口）都是同源，不需要 CORS。原来默认允许 `http://localhost:5173`，那么任何占用 5173 端口的页面（比如别的项目的 Vite）都能在浏览器里调用本应用的接口，包括删除。
>    - 现在只有设置了 `APP_CORS_ALLOWED_ORIGINS`（逗号分隔，可以写多个来源）才会开启，[WebConfig](../../backend/src/main/java/com/bookscoreideas/config/WebConfig.java) 在为空时不注册映射。
>    - `start-dev.ps1` 不再设置这个变量。
> 3. **devtools 保持现状**：继续自动重启，"跑 mvn 前先确认 8080 空闲"的约定不变。
> 4. **更正评审描述**：devtools **没有**被打进 jar。`spring-boot-maven-plugin` 默认会把它排除，实际检查 jar 也确认不包含，所以这一点无需改动。
> 5. 开工时还发现 H2 的 `AUTO_SERVER` 在所有网卡上开着端口，已作为 [SEC-03 补充](05-security.md#sec-03) 单独修复并提交。
>
> **测试**
> - [NetworkExposureTest](../../backend/src/test/java/com/bookscoreideas/web/NetworkExposureTest.java)：
>   - dev 测试改为显式使用 dev profile；
>   - 新增"不带 profile：只监听本机、没有 Console"，改动前失败；
>   - 新增"`dev,prod` 时 prod 胜出"。
> - [CorsDefaultTest](../../backend/src/test/java/com/bookscoreideas/config/CorsDefaultTest.java)：默认配置下，来自 `localhost:5173` 和外部来源的预检请求、普通请求，都拿不到 `Access-Control-Allow-Origin`。改动前失败。
> - [CorsConfigTest](../../backend/src/test/java/com/bookscoreideas/config/CorsConfigTest.java)：改为显式配置两个来源后，BUG-04 的各方法预检仍然通过，其他来源返回 403。多来源那项在改动前失败。
> - 后端 173 个测试通过。
>
> **验证**（真实数据副本）
> - 改动前后 2,748 个 GET 响应零差异，12 张表不变。
> - 按 start-dev 的方式运行：`SPRING_PROFILES_ACTIVE=dev` + `mvn spring-boot:run`，再加 Vite 代理。日志显示 dev profile 生效、Console 可用、迁移到 V9；只监听 `127.0.0.1` / `::1`，从局域网 IP 连接被拒绝。
>   - 跨域 GET 不带 `Access-Control-Allow-Origin`；
>   - 经 Vite 代理、带 `Origin` 头的 POST 和 DELETE 正常（201 / 204），说明去掉 CORS 不影响同源写入；
>   - 浏览器打开书籍详情页正常。
> - 打包的 jar：不带 profile 时没有 Console；prod + dist 时没有 Console，前端正常。

**建议**：`application-dev.properties` / `application-prod.properties`；`start-prod.ps1` 传 `--spring.profiles.active=prod`。具体安全项见 [SEC-03](05-security.md#sec-03)。

---

<a id="be-10"></a>
## BE-10 · Spring Boot 3.2.x 已停止 OSS 支持 🟡

[pom.xml](../../backend/pom.xml) 使用 `spring-boot-starter-parent 3.2.5`，该版本线已过开源支持期，不再接收安全补丁（包括 Tomcat、Jackson、H2 等传递依赖）。

**建议**：升级到当前受支持的 Spring Boot 版本线（升级前先补测试，见 ENG-01）；同时引入 Maven Wrapper（ENG-04）。

> 升级时顺带检查：`ContentDisposition` 对非 ASCII 文件名生成的兜底 `filename=` 参数，引号是否已转义（见 [SEC-02](05-security.md#sec-02)）。

> **🔄 进行中（2026-11-01）**：分两步，每步单独验证、单独提交。第一步 3.2.5 → **3.5.16** 已完成。
>
> **设计决定**（简单项，按最佳判断）
> 1. **目标版本**：中间站 3.5.16（3.x 最后一条版本线的最新补丁），终点 4.1.2（当前最新的正式版；4.2 只有 RC）。先到 3.5 是为了在 Boot 3 内把弃用 API 清干净，再做 4.0 的不兼容改动，两步的问题不会混在一起。
> 2. **跟着升大版本的库**用 Spring Boot 管理的版本，不单独固定：
>
>    | | 3.2.5 | 3.5.16 | 4.1.2 |
>    |---|---|---|---|
>    | H2 | 2.2.224 | 2.3.232 | 2.4.240 |
>    | Flyway | 9.22 | 11.7 | 12.4 |
>    | Hibernate | 6.4 | 6.6 | 7.4 |
>    | Jackson | 2.15 | 2.21 | 3.1 |
>    | Spring / Tomcat | 6.1 / 10.1 | 6.2 / 10.1 | 7.0 / 11.0 |
>
>    前提是新版本能打开现有的库文件、迁移结果不变，每一步都在真实数据副本上演练确认。
> 3. **升级前备份**：`backups\data-20261101-103024-before-be10-spring-boot.zip`。
>
> **第一步：3.5.16**
> - 编译时打开弃用警告（`-Dmaven.compiler.showDeprecation=true`）：main 代码没有用到弃用 API；测试中的 3 处 `@SpyBean`（3.4 起弃用，4.0 删除）改为 Spring Framework 的 `@MockitoSpyBean`。其中一处 spy 的是 Spring Data 仓库接口（JDK 代理），换用后照常工作。
> - `GlobalExceptionHandler` 中处理 `AsyncRequestNotUsableException` 的方法删除：Spring 6.2 的基类 `ResponseEntityExceptionHandler` 已经处理它（不响应、不记 ERROR），两者同时存在时启动失败（"Ambiguous @ExceptionHandler"）。这正是 FE-03 当时预留的说明。[ClientAbortTest](../../backend/src/test/java/com/bookscoreideas/web/ClientAbortTest.java) 不改，照常通过。
> - 删除 `spring.jpa.database-platform=…H2Dialect`：Hibernate 6.6 提示它是多余的（HHH90000025），方言由 JDBC 元数据自动识别为同一个 `H2Dialect`。
> - 临时加入 `spring-boot-properties-migrator` 检查配置项：没有被改名或删除的配置。检查完已移除。
> - **`ContentDisposition` 兜底参数**：Spring 6.1 生成的 `filename="=?UTF-8?Q?…_"1".png?="` 中引号没有转义，按 RFC 7230 严格解析 quoted-string 的客户端会在第一个引号处截断；Spring 6.2 改为编码成 `=22`。[ImageTypeSafetyTest](../../backend/src/test/java/com/bookscoreideas/books/ImageTypeSafetyTest.java) 增加断言：严格提取兜底参数后也能还原文件名。Spring 自己的 `parse()` 很宽松，旧版本的输出也能"读懂"，所以断言不用它来提取。该断言在 3.2.5 上失败、3.5.16 上通过。浏览器优先使用 `filename*`，对用户没有可见影响。
> - 测试：后端 212 个全部通过。
> - **真实数据副本**：
>   - 新版本（H2 2.3.232 + Flyway 11）直接打开 V7 的库文件，校验 11 个迁移后执行 V8、V9；
>   - 与改动前的 jar 相比，2,749 个 GET 响应零差异，各表内容和导出的 schema 完全相同；
>   - `roundtrip.py`：只有已知的 book 195（5 张图片在本机没有文件）；
>   - **回退**：改动前的 jar（H2 2.2.224 + Flyway 9）能打开被 3.5.16 写过的库，校验通过、接口正常；
>   - 启动日志：改动前的两条 WARN（Flyway 不认识 H2 2.2.224、多余的方言设置）都消失了，没有新的告警。
