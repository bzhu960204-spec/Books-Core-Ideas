# Migrate 功能技术文档

> 书籍数据迁移（Migrate）模块：将整本书（含章节、核心观点、摘录、AI 讲解、章节图片）导出为可移植的 ZIP 归档，并可在另一套部署中导入还原。

## 1. 功能概述

Migrate 模块用于在不同的应用实例之间**整本搬运书籍数据**，典型场景：

- 备份 / 迁移到新环境
- 在多台机器间同步书库
- 分享单本或多本书给其他使用者

导出产物是一个**自包含的 ZIP 归档**，内含每本书的完整 JSON 快照与原始图片文件。导入时按书逐本落库，重复的书（同标题 + 同作者）会被自动跳过，互不影响。

涉及的数据实体：`Book` → `Part`（可选分部结构）→ `Chapter` → {`KeyIdea`, `Excerpt`, `ChapterExplanation`, `ChapterImage`}。

## 2. 整体架构

```
前端 BookMigrationModal.jsx
        │  (migrationApi: export / preview / import)
        ▼
MigrationController  (/api/migration/*)
        │
        ▼
MigrationService   ← 编排：读写 ZIP、构建/解析 DTO、冲突检测、图片文件读写
        │
        ▼
MigrationImporter  ← 单本书事务性落库（@Transactional）
        │
        ▼
各 Repository / 实体 + 磁盘图片目录 (app.upload.dir)
```

- **MigrationService**：无状态编排层，负责 ZIP 打包/解包、Jackson 序列化、冲突检测、图片文件系统读写。
- **MigrationImporter**：独立组件，`persistBook` 标注 `@Transactional`，**每本书一个事务**——一本失败只回滚该本，不影响其余。图片字节不在事务内写盘，而是作为 `PendingImageWrite` 返回，待事务提交后再落盘，避免"数据库回滚但文件残留"。

### 关键源码

| 层 | 文件 |
| --- | --- |
| 前端弹窗 | [frontend/src/components/BookMigrationModal.jsx](../frontend/src/components/BookMigrationModal.jsx) |
| 前端 API | [frontend/src/api.js](../frontend/src/api.js#L139) |
| 控制器 | [backend/src/main/java/com/bookscoreideas/controller/MigrationController.java](../backend/src/main/java/com/bookscoreideas/controller/MigrationController.java) |
| 编排服务 | [backend/src/main/java/com/bookscoreideas/service/MigrationService.java](../backend/src/main/java/com/bookscoreideas/service/MigrationService.java) |
| 落库组件 | [backend/src/main/java/com/bookscoreideas/service/MigrationImporter.java](../backend/src/main/java/com/bookscoreideas/service/MigrationImporter.java) |
| 归档 DTO | [backend/src/main/java/com/bookscoreideas/dto/migration/](../backend/src/main/java/com/bookscoreideas/dto/migration/) |

## 3. REST API

基础路径：`/api/migration`

| 方法 | 路径 | 说明 | 请求 | 响应 |
| --- | --- | --- | --- | --- |
| POST | `/export` | 导出指定书籍（`bookIds` 为空或 null 则导出全部） | `ExportRequestDto { bookIds: Long[] }` | `application/zip` 流（`StreamingResponseBody`） |
| GET | `/export/{bookId}` | 导出单本书的快捷入口 | 路径参数 | `application/zip` 流 |
| POST | `/import/preview` | 预览归档内容、检测冲突（**不写库**） | `multipart/form-data` 字段 `file` | `ImportPreviewDto` |
| POST | `/import` | 实际导入归档 | `multipart/form-data` 字段 `file` | `ImportResultDto` |

导出响应带 `Content-Disposition: attachment; filename="books-export-<yyyy-MM-dd>.zip"`，并使用 `StreamingResponseBody` 边打包边输出，避免大归档占满内存。

预览 / 导入对非法归档返回 `400 Bad Request`，错误信息来自 `IllegalArgumentException`（如 `manifest.json` 缺失）或 `IOException`。

## 4. 归档文件格式（ZIP 布局）

当前格式版本 `FORMAT_VERSION = 1`。

```
books-export-2026-10-01.zip
├── manifest.json                       # 顶层索引
└── books/
    ├── <slug>/
    │   ├── book.json                   # 单本书完整快照 (BookArchiveDto)
    │   └── images/
    │       ├── <filename1>.png         # 原始图片文件
    │       └── <filename2>.jpg
    └── <slug-2>/
        └── book.json
```

- `slug` 由书名 `slugify` 生成（小写、非字母数字与非中日韩汉字替换为 `-`），同名书追加 `-2`、`-3` 保证唯一。
- `images/` 下的文件名就是数据库中记录的 `ChapterImage.filename`。导出时经过路径规范化并校验 `startsWith(uploadDir)`，防止路径穿越。

### manifest.json（`ManifestDto`）

```json
{
  "formatVersion": 1,
  "exportedAt": "2026-10-01T12:34:56.789",
  "books": [
    {
      "slug": "atomic-habits",
      "title": "Atomic Habits",
      "author": "James Clear",
      "path": "books/atomic-habits/book.json",
      "chapterCount": 20,
      "imageCount": 5
    }
  ]
}
```

### book.json（`BookArchiveDto`）

单本书的自包含快照，字段与实体一一对应：

- 书级元数据：`title`、`author`、`isbn`、`description`、`coverUrl`、`rating`、`category`、`readingStatus`、`dateAdded`、`startDate`、`finishDate`、`chapterImagesEnabled`。
- `structureType`：`"CHAPTERS"`（扁平章节）或 `"PARTS"`（分部结构）。
- 结构二选一：
  - `parts`：`PartArchiveDto[]`，每个分部含 `title`、`orderIndex`、`summary` 及其 `chapters`。
  - `chapters`：`ChapterArchiveDto[]`（无分部时）。
- 每个 `ChapterArchiveDto` 含 `title`、`orderIndex`、`summary`，以及：
  - `explanation`：`ExplanationArchiveDto { content, updatedAt }`（AI 讲解，可空）
  - `keyIdeas`：`KeyIdeaArchiveDto[]`（`content`、`example`、`tags`、`highlighted`、`orderIndex`）
  - `excerpts`：`ExcerptArchiveDto[]`（`content`、`note`、`source`、`highlighted`、`orderIndex`）
  - `images`：`ImageArchiveDto[]`（`filename`、`originalName`、`contentType`、`orderIndex`）

日期类型在归档中统一序列化为 ISO 字符串（`toStringOrNull`），导入时用 `LocalDate.parse` 容错解析，解析失败置为 `null`。

## 5. 导出流程

`MigrationService.exportBooks(bookIds, outputStream)`：

1. 按 `bookIds` 取书（为空则 `findAll()`）。
2. 对每本书：
   - 生成唯一 `slug`。
   - `buildBookDto` 组装完整 `BookArchiveDto`（按 `structureType` 决定走 parts 还是 chapters 分支，子项均按 `orderIndex` 升序查询）。
   - 写入 `books/<slug>/book.json`。
   - 遍历全部章节图片，从 `uploadDir` 读取原始文件写入 `books/<slug>/images/`；缺失或越界文件跳过。
   - 累加 `ManifestEntryDto`。
3. 最后写入 `manifest.json`（pretty-print）。

全程使用 `ZipOutputStream` 流式写出。

## 6. 导入流程

### 预览 `previewArchive`（只读）

1. `readZip` 将归档解包进内存 `Map<path, bytes>`（带防护，见第 7 节）。
2. `readManifest` 校验 `manifest.json` 存在且 `books` 非空。
3. 加载现有书库的 `(title, author)` 归一化键集合。
4. 逐本解析 `book.json`，判定是否冲突（已存在或归档内重复），统计 `conflicts`，并标记每本是否含 AI 讲解。
5. 返回 `ImportPreviewDto { formatVersion, totalBooks, conflicts, books[] }`。

### 导入 `importArchive`

1. 同样 `readZip` + `readManifest`。
2. 逐本处理：
   - 解析 `book.json` 失败 → 计入 `failed`。
   - **冲突检测**：`bookKey = norm(title) + "\0" + norm(author)`（`norm` = trim + lowercase）。命中现有键 → `SKIPPED_CONFLICT`。
   - 否则 `collectImages` 收集该书 `images/` 下文件，调用 `importer.persistBook(dto, images)` 在**独立事务**内落库。
   - 事务成功后 `writeImages` 将 `PendingImageWrite` 写入 `uploadDir`（再次校验 `startsWith(uploadDir)` 防穿越），并把键加入已存在集合（防止同批次重复导入）。
3. 返回 `ImportResultDto { booksImported, booksSkipped, booksFailed, details[] }`，`details` 中每条为 `ImportBookResultDto`，`status` ∈ `IMPORTED` / `SKIPPED_CONFLICT` / `FAILED`。

### 落库细节（`MigrationImporter.persistBook`）

- 新建 `Book`（**不保留原始 ID**，由数据库重新生成），按 `structureType` 建 `Part` / `Chapter` 树。
- 图片：为每个 `ChapterImage` **生成新的 `UUID + 原扩展名** 作为磁盘文件名，避免跨实例文件名冲突；无对应字节的图片记录跳过。
- 图片字节暂存于 `PendingImageWrite` 列表返回，事务提交后才写盘。

## 7. 安全与健壮性

- **Zip Bomb 防护**：解包时限制累计解压大小 `MAX_TOTAL_UNCOMPRESSED = 500 MB`、条目数 `MAX_ENTRIES = 50000`，超限抛 `IllegalArgumentException`。
- **路径穿越防护**：导出读图与导入写图均 `normalize()` 后校验 `startsWith(uploadDir)`；条目名统一 `\` → `/`。
- **事务隔离**：每本书独立事务，单本失败不污染整体；图片先入库后落盘，保证一致性。
- **冲突幂等**：基于归一化 `(title, author)` 去重，重复导入不会产生副本。
- **上传大小限制**：`application.properties` 中 `spring.servlet.multipart.max-file-size=200MB`、`max-request-size=220MB`，以容纳多书归档。

## 8. 前端交互

`BookMigrationModal.jsx` 提供 Export / Import 两个 Tab：

- **Export**：列出书库，支持按标题/作者过滤、全选（仅作用于当前过滤结果），调用 `migrationApi.exportBooks` 获取 Blob 并触发浏览器下载。
- **Import**：支持拖拽 / 点击选择多个 `.zip`；每个文件先调 `preview` 展示书数、图片数、是否含讲解、是否冲突；点击导入时逐文件串行调用 `import`，带进度条，最后聚合 `imported / skipped / failed` 汇总。非 zip 文件、重复文件（按 `name+size`）会被过滤。

`migrationApi`（[frontend/src/api.js](../frontend/src/api.js#L139)）封装三个端点，导出从 `Content-Disposition` 解析下载文件名。

## 9. 版本演进注意事项

- 归档以 `formatVersion` 标记（当前 `1`）。新增字段应保持向后兼容（Jackson 默认忽略未知字段 / 旧归档缺字段为 null）。
- 若未来引入破坏性结构变更，应提升 `FORMAT_VERSION` 并在导入侧按版本分支处理。
