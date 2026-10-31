# API 约定

> 2026-10-31 随 BE-03 / BE-05 建立。新增或修改接口时以此为准；[ApiConventionsTest](../backend/src/test/java/com/bookscoreideas/web/ApiConventionsTest.java) 和 [InputValidationTest](../backend/src/test/java/com/bookscoreideas/web/InputValidationTest.java) 会检查这些约定。

## 状态码

| 情况 | 状态码 | 例子 |
|---|---|---|
| 读取 / 更新成功 | 200 + 资源 | `GET /api/books/{id}`、`PUT /api/books/{id}`、`PATCH /api/marks/{id}` |
| 新建成功 | **201** + 新建的资源（不带 `Location` 头：多数子资源没有单独的 GET） | `POST /api/books`、`POST /api/chapters/{id}/ideas`、`POST /api/chapters/{id}/images`（返回本次上传的列表） |
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
- JSON 导入（FE-08）：每个请求**一个事务**，任何一处不合法都不会留下任何数据。
  - `POST /api/books/import`：`{ "books": [...] }`，返回 **201** 和新建的书（`BookDto` 列表，顺序与请求相同）；
  - `POST /api/books/{id}/import`：`{ "mode": "ADD"|"REPLACE", "parts": [...], "chapters": [...] }`，导入已有书的结构；
  - `POST /api/books/{id}/import/content`：`{ "mode", "chapters": [{ "chapterId" | "chapter": 标题, "ideas", "excerpts" }] }`，向已有章节导入想法和摘录。
  - 后两个返回 200 和 `{ parts, chapters, ideas, excerpts }`（新建的数量）。书不存在时返回 404；章节找不到、结构不符（如向 CHAPTERS 书导入 parts）时返回 400。

## 错误格式

所有错误都是 RFC 7807 `application/problem+json`，由 [GlobalExceptionHandler](../backend/src/main/java/com/bookscoreideas/web/GlobalExceptionHandler.java) 统一生成：

- 服务层抛 `NotFoundException` → 404；抛 `IllegalArgumentException` → 400。
- 控制器用 [Responses](../backend/src/main/java/com/bookscoreideas/web/Responses.java) 的 `ok` / `created` / `deleted` 生成成功响应；"不存在"由它们抛出，不再返回空体的 404。
- 前端的 `api.js` 中，`errorMessage()` 优先显示 `detail`。

## 请求体

- 一律是带 Bean Validation 的 record（`@Valid`），不用 `Map`，也不直接用实体。
  - 客户端发来的 `id` 等不可编辑字段会被忽略（BUG-09 / BUG-13）。
- 文本长度上限 = 数据库列宽。枚举类字段的允许值集中在 [BookValues](../backend/src/main/java/com/bookscoreideas/dto/BookValues.java)。
- 更新是"整体替换"（`PUT /api/books/{id}`：省略的字段会被清空）。例外是书评：null 表示"不改"。
- 从页面截取的上下文（标记的 `prefix` / `suffix`）和标记批注会被截断而不是拒绝，因为长度不由用户控制。

## 响应体

- 一律是 record DTO，不直接返回实体（BE-01 / BE-02）。
- 新增 GET 接口时，同步更新真实数据对比工具 [capture_api.py](../tools/rehearsal/capture_api.py)。
