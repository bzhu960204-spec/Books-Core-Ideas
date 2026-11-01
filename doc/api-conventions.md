# API 约定

> 2026-10-31 随 BE-03 / BE-05 建立。新增或修改接口时以此为准；[ApiConventionsTest](../backend/src/test/java/com/bookscoreideas/web/ApiConventionsTest.java) 和 [InputValidationTest](../backend/src/test/java/com/bookscoreideas/web/InputValidationTest.java) 会检查这些约定。

## 状态码

| 情况 | 状态码 | 例子 |
|---|---|---|
| 读取 / 更新成功 | 200 + 资源 | `GET /api/books/{id}`、`PUT /api/books/{id}`、`PATCH /api/marks/{id}` |
| 新建成功 | **201** + 新建的资源（不带 `Location` 头：多数子资源没有单独的 GET） | `POST /api/books`、`POST /api/chapters/{id}/ideas` |
| 删除成功 | **204**，无响应体 | `DELETE /api/books/{id}` |
| 资源不存在，或父资源不存在（如 `/books/999/chapters`） | **404** ProblemDetail | `{"status":404,"detail":"Book not found: 999"}` |
| 可选的单个资源为空：资源本身不存在，但这是正常状态 | **204** | 章节还没有讲解：`GET /api/chapters/{id}/explanation`；书还没有书签：`GET /api/books/{id}/bookmarks/latest` |
| 查询参数筛选不到结果 | 200 + `[]` | `GET /api/ideas?bookId=999`（筛选条件，不是父资源） |
| 请求体不合法（缺字段、超长、越界、类型错误、JSON 格式错误） | 400 ProblemDetail，`detail` 写明字段 | `title: size must be between 0 and 255`、`scrollRatio: must be a valid Double` |
| 违反数据库约束（理论上校验已拦住） | 409 ProblemDetail | |
| 未预期的错误 | 500 ProblemDetail（只返回通用提示，详情写日志） | |

非 CRUD 的动作按语义处理：
- 把书加入书单 `POST /api/book-collections/{id}/books/{bookId}`：这是建立关联，不是新建资源，返回 204；
- 讲解的 `PUT /api/chapters/{id}/explanation` 是 upsert，返回 200；
- 迁移导出、导入、预览返回 200：导入的响应是逐本书的报告，其中可能有跳过或失败的书。
- 章节图片上传 `POST /api/chapters/{id}/images`（BUG-10）同样返回报告：`{ "images": [新建的图片], "skipped": [{ "name", "reason" }] }`。至少保存一张时为 **201**，一张都没保存时为 **200**。`reason` 是给用户看的一句话。
- JSON 导入（FE-08）：每个请求**一个事务**，任何一处不合法都不会留下任何数据。
  - `POST /api/books/import`：`{ "books": [...] }`，返回 **201** 和新建的书（`BookDto` 列表，顺序与请求相同）；
  - `POST /api/books/{id}/import`：`{ "mode": "ADD"|"REPLACE", "parts": [...], "chapters": [...] }`，导入已有书的结构；
  - `POST /api/books/{id}/import/content`：`{ "mode", "chapters": [{ "chapterId" | "chapter": 标题, "ideas", "excerpts" }] }`，向已有章节导入想法和摘录。
  - 后两个返回 200 和 `{ parts, chapters, ideas, excerpts }`（新建的数量）。书不存在时返回 404；章节找不到、结构不符（如向 CHAPTERS 书导入 parts）时返回 400。

## 错误格式

所有错误都是 RFC 7807 `application/problem+json`，由 [GlobalExceptionHandler](../backend/src/main/java/com/bookscoreideas/web/GlobalExceptionHandler.java) 统一生成：

- 字段：`title`、`status`、`detail`、`instance`。Spring Boot 4（BE-10）起不再输出 `"type": "about:blank"`：RFC 9457 规定省略 `type` 就表示 `about:blank`。
- 服务层抛 `NotFoundException` → 404；抛 `IllegalArgumentException` → 400。
- 控制器用 [Responses](../backend/src/main/java/com/bookscoreideas/web/Responses.java) 的 `ok` / `created` / `deleted` 生成成功响应；"不存在"由它们抛出，不再返回空体的 404。
- 前端的 `api.js` 中，`errorMessage()` 优先显示 `detail`；连不上后端（`fetch` 失败，或开发代理返回空的 502/503/504）时统一为 `Cannot reach the server. Is the backend running?`。
- 前端写操作失败时显示"做什么失败 — detail"的 toast，表单或确认框保持打开（FE-05，`components/feedback/toast.js` 的 `attempt` / `reportError`）。所以 `detail` 要写成用户能看懂的一句话。

## 请求体

- 一律是带 Bean Validation 的 record（`@Valid`），不用 `Map`，也不直接用实体。
  - 客户端发来的 `id` 等不可编辑字段会被忽略（BUG-09 / BUG-13）。
- JSON 绑定（Jackson 3，BE-10；[JsonBindingTest](../backend/src/test/java/com/bookscoreideas/web/JsonBindingTest.java)）：
  - 未知字段忽略；
  - 布尔标志（如 `highlighted`）省略或为 `null` 时按 `false` 处理；
  - 请求体中第一个 JSON 值之后还有内容时返回 400（Jackson 2 会忽略多出的部分）；
  - 响应字段按 record 中声明的顺序输出。
- 日期和时间（DB-06）：
  - 书的 `dateAdded` / `startDate` / `finishDate` 是日期：`2026-01-02`；
  - 其他时间都是不带时区的 ISO 日期时间（Java `LocalDateTime.toString()`，小数位数不固定，整分时省略秒）：书评和讲解的 `updatedAt`、书签的 `createdAt`、标记和书单的 `createdAt` / `updatedAt`，例如 `2026-11-01T12:47:26.235039`、`2026-06-09T00:00`。书评和讲解在 DB-06 之前只存日期，这些旧值为当天 0 点，界面上只显示日期部分。
- 枚举值（DB-06）：`readingStatus` 为 `WANT_TO_READ` / `READING` / `FINISHED`，未设置时响应中为 `null`；请求中 `""` 与 `null` 都表示未设置。`structureType` 为 `CHAPTERS` / `PARTS`。
- 文本长度上限 = 数据库列宽。枚举类字段的允许值集中在 [BookValues](../backend/src/main/java/com/bookscoreideas/dto/BookValues.java)。
- 书评和讲解的富文本正文（CLOB）上限 2,000 万字符（约 20 MB，[RichTextLimits](../backend/src/main/java/com/bookscoreideas/dto/RichTextLimits.java)，DB-04）。上限定得宽松，只为挡住意外（粘贴的图片以 base64 内联在正文中）。超过时返回 400：`content: must be at most 20 MB (pasted images take the most space)`。
- 上传的章节图片只接受 PNG / JPEG / GIF / WebP，按**文件内容**判断，不看客户端声明的类型或扩展名（SEC-02，[ImageType](../backend/src/main/java/com/bookscoreideas/service/ImageType.java)）。下载时同样按文件内容决定 `Content-Type`，并带上 `nosniff` 和 `sandbox` CSP。
- 更新是"整体替换"（`PUT /api/books/{id}`：省略的字段会被清空）。例外是书评：null 表示"不改"。
- 从页面截取的上下文（标记的 `prefix` / `suffix`）和标记批注会被截断而不是拒绝，因为长度不由用户控制。上传图片的原始文件名同理（超过 255 截断）。

## 响应体

- 一律是 record DTO，不直接返回实体（BE-01 / BE-02）。
- 新增 GET 接口时，同步更新真实数据对比工具 [capture_api.py](../tools/rehearsal/capture_api.py)。

## `/api` 以外

- `GET /actuator/health`（ENG-06）：只返回 `{"status":"UP"}`（数据库可连）或 `DOWN`，不含细节；其他 actuator 端点都不暴露（404），包括 Spring Boot 4 默认开启的 `/actuator/health/liveness`、`/readiness`（BE-10 中关闭）。start 脚本用它判断应用是否就绪。
- prod 单端口模式下，其他未知路径返回前端的 `index.html`（客户端路由），但 `/api/`、`/h2-console`、`/actuator` 下的路径从不回退。
