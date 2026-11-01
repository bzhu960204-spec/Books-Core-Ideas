# Migrate 功能技术文档

> 书籍数据迁移（Migrate）模块：将整本书（含章节、核心观点、摘录、AI 讲解、章节图片、书评、阅读书签、讲解摘录标记、所在书单）导出为可移植的 ZIP 归档，并可在另一套部署中导入还原。
>
> 归档格式 v2（2026-10-31，BE-08）起，一本书拥有的数据全部随书导出，原始时间戳也会保留。范围与限制见第 4 节"归档范围"。

## 1. 功能概述

Migrate 模块用于在不同的应用实例之间**整本搬运书籍数据**，典型场景：

- 备份 / 迁移到新环境
- 在多台机器间同步书库
- 分享单本或多本书给其他使用者

导出产物是一个**自包含的 ZIP 归档**，内含每本书的完整 JSON 快照与原始图片文件。导入时按书逐本落库，重复的书（同标题 + 同作者）会被自动跳过，互不影响。

涉及的数据实体：`Book` → `Part`（可选分部结构）→ `Chapter` → {`KeyIdea`, `Excerpt`, `ChapterExplanation`, `ChapterImage`, `ReadingBookmark`, `ExplanationMark`}；`Book` → `BookReview`；书所在的 `BookCollection`（以路径表示）。

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

- **MigrationService**：无状态编排层，负责 ZIP 打包/解包、Jackson 序列化、格式版本检查、冲突检测、图片文件系统读写。
- **BookArchiveBuilder**：把一本书及其拥有的全部数据读成 `BookArchiveDto`，是**唯一**遍历书籍树的地方。ZIP 迁移直接写出它；单本 JSON 导出（`GET /api/books/{id}/export`）把它映射成 JSON 导入格式（BE-06：原先两套导出各自遍历，字段也各自维护）。
- **MigrationImporter**：独立组件，`persistBook` 标注 `@Transactional`，**每本书一个事务**——一本失败只回滚该本，不影响其余。图片文件在这个事务中写盘，并登记"回滚就删除"（`ChapterImageStorage.deleteIfRolledBack`），所以失败的书既不入库，也不留文件（BE-07）。

### 关键源码

| 层 | 文件 |
| --- | --- |
| 前端弹窗 | [frontend/src/components/BookMigrationModal.jsx](../frontend/src/components/BookMigrationModal.jsx) |
| 前端 API | [frontend/src/api.js](../frontend/src/api.js#L139) |
| 控制器 | [backend/src/main/java/com/bookscoreideas/controller/MigrationController.java](../backend/src/main/java/com/bookscoreideas/controller/MigrationController.java) |
| 编排服务 | [backend/src/main/java/com/bookscoreideas/service/MigrationService.java](../backend/src/main/java/com/bookscoreideas/service/MigrationService.java) |
| 读取快照 | [backend/src/main/java/com/bookscoreideas/service/BookArchiveBuilder.java](../backend/src/main/java/com/bookscoreideas/service/BookArchiveBuilder.java) |
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

预览 / 导入对非法归档返回 `400 Bad Request`（ProblemDetail，原因在 `detail` 中；BE-03 之前是纯文本）。原因包括：未提供文件、`manifest.json` 缺失、格式版本比本应用新、文件不是可读的 ZIP。

## 4. 归档文件格式（ZIP 布局）

当前格式版本 `FORMAT_VERSION = 2`。导入接受版本 ≤ 2 的归档（v1 归档照常导入，缺少的部分为空）；**更新版本的归档会被拒绝（400）**，而不是丢掉不认识的内容后"导入成功"。

| 版本 | 内容 |
|---|---|
| 1 | 书、Part、章节、想法、摘录、讲解、章节图片 |
| 2（BE-08） | 另加书评 `reviews`、每章的阅读书签 `bookmarks` 和讲解标记 `marks`、书所在书单 `collectionPaths`；导入时保留原始时间戳（书评与讲解的 `updatedAt`，书签与标记的 `createdAt` / `updatedAt`） |

### 归档范围

- **包含**：一本书拥有的全部数据（上表），以及它在哪些书单里。
- **不包含**：
  - 不含书的空书单；
  - 书单的排序、创建时间，以及书加入书单的时间（导入时新建的书单排在默认位置）；
  - 数据库里有记录、但图片文件已不存在的章节图片（导出时没有文件；导入时跳过，并在导入结果中写明 "missing from the archive"）。
- **定位**：ZIP 用于"分享 / 迁移书"。整库灾备请用 `backup-data.ps1`（复制整个数据库与图片目录），见 [DB-05](improvement-review/03-database-and-data-safety.md#db-05)。

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
  "formatVersion": 2,
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
  - `bookmarks`（v2）：`BookmarkArchiveDto[]`（`scrollRatio`、`note`、`createdAt`）。阅读历史时间线按 `createdAt` 排序，所以原样保留。
  - `marks`（v2）：`MarkArchiveDto[]`（`quote`、`prefix`、`suffix`、`startOffset`、`endOffset`、`note`、`createdAt`、`updatedAt`）。偏移量指向同一章节 `explanation` 的正文，两者一起导出，导入后仍然有效。
- `reviews`（v2）：`ReviewArchiveDto[]`（`title`、`content`、`updatedAt`）。
- `collectionPaths`（v2）：书所在的每个书单，用从根到该书单的名称数组表示，例如 `[["心理学", "习惯"], ["待读"]]`。不使用 ID，因为 ID 在另一套部署里没有意义。
- 列表按创建顺序（ID 升序）导出，导入后各条目的相对顺序不变。

日期类型在归档中统一序列化为 ISO 字符串（日期 `2026-10-31`，时间 `2026-10-31T12:34:56.789`），导入时容错解析：解析失败或缺失时，由实体自己填入"现在"。

## 5. 导出流程

`MigrationService.exportBooks(bookIds, outputStream)`：

1. 按 `bookIds` 取书（为空则 `findAll()`）。
2. 对每本书：
   - 生成唯一 `slug`。
   - `BookArchiveBuilder.build` 组装完整 `BookArchiveDto`（按 `structureType` 决定走 parts 还是 chapters 分支，子项均按 `orderIndex` 升序查询；书评、书签、标记按创建顺序；书单路径排序后输出）。
   - 写入 `books/<slug>/book.json`。
   - 遍历全部章节图片，从 `uploadDir` 读取原始文件写入 `books/<slug>/images/`；缺失或越界文件跳过。
   - 累加 `ManifestEntryDto`。
3. 最后写入 `manifest.json`（pretty-print）。

全程使用 `ZipOutputStream` 流式写出。

## 6. 导入流程

控制器先把上传存为系统临时目录中的 `bci-migration-*.zip`，处理完（包括出错时）删除。服务层用 `ZipFile` 打开它，按中央目录建立条目索引，**按需读取**条目，不把整个归档读进内存（BE-07）。

### 预览 `previewArchive`（只读）

1. 打开归档（带防护，见第 7 节）；只读取 `manifest.json` 和各本书的 `book.json`，不打开图片。
2. `readManifest` 校验 `manifest.json` 存在、`books` 非空，且 `formatVersion` 不高于本应用支持的版本。
3. 加载现有书库的 `(title, author)` 归一化键集合。
4. 逐本解析 `book.json`，判定是否冲突（已存在或归档内重复），统计 `conflicts`，并标记每本是否含 AI 讲解，统计书评、书签、标记、书单的数量。
5. 返回 `ImportPreviewDto { formatVersion, totalBooks, conflicts, books[] }`。

### 导入 `importArchive`

1. 同样打开归档并 `readManifest`（含格式版本检查）。
2. 逐本处理：
   - 解析 `book.json` 失败 → 计入 `failed`。
   - **冲突检测**：`bookKey = norm(title) + "\0" + norm(author)`（`norm` = trim + lowercase）。命中现有键 → `SKIPPED_CONFLICT`。
   - 否则调用 `importer.persistBook(dto, archive.imagesOf(path))` 在**独立事务**内落库；图片按 `<book.json 所在目录>/images/<filename>` 从归档中按需读取。
   - 成功后把键加入已存在集合（防止同批次重复导入）；失败时记录警告日志并报告 `FAILED`。
3. 返回 `ImportResultDto { booksImported, booksSkipped, booksFailed, details[] }`，`details` 中每条为 `ImportBookResultDto`，`status` ∈ `IMPORTED` / `SKIPPED_CONFLICT` / `FAILED`。

### 落库细节（`MigrationImporter.persistBook`）

- 新建 `Book`（**不保留原始 ID**，由数据库重新生成），按 `structureType` 建 `Part` / `Chapter` 树。
- 书签、标记的 `book_id` 取导入后的新书（数据库复合外键要求它与章节所属的书一致）。
- 书评、讲解、书签、标记带上归档中的原始时间戳。实体的 `@PrePersist` 只在时间戳为空时才填"现在"；之后的修改仍由 `@PreUpdate` 更新。
- 书单：对每条 `collectionPaths` 调用 `BookCollectionService.findOrCreatePath`，从根开始逐级查找同名子书单（名称去掉首尾空格），没有就新建，再把书加进去。这样导入的路径会**合并**进现有的树，不会重复建出同名书单。这一步在本书的同一事务内完成，失败时一起回滚。
- 图片：为每个 `ChapterImage` **生成新的 `UUID + 扩展名`** 作为磁盘文件名，避免跨实例文件名冲突。扩展名和 `contentType` 由图片字节决定（SEC-04，与上传共用 `ImageType`），不使用归档中的文件名和 `contentType`。不是 PNG / JPEG / GIF / WebP 的文件，以及归档中缺少文件的图片，都不导入，并在这本书的结果 `message` 中逐一列出，例如 "Skipped 2 images: logo.svg (not a PNG, JPEG, GIF or WebP image); gone.png (missing from the archive)"。前端把它显示在书名下方。
- 图片文件在本书的事务中**流式**写入 `uploadDir`（不经过内存中的字节数组），写入前登记"回滚就删除"，写到一半的文件也会删掉。任何一张图片读写失败，整本书回滚并报告 `FAILED`，例如 "Import failed: Could not import image b.png: disk full"，可以在处理好问题后重新导入（BE-07）。

## 7. 安全与健壮性

- **Zip Bomb 防护**：打开归档时检查条目数 `MAX_ENTRIES = 50000` 和各条目声明的解压大小之和 `MAX_TOTAL_UNCOMPRESSED = 500 MB`，超限返回 400，不导入任何书；读取时每个条目读出的字节不能超过它声明的大小，否则报"归档已损坏"（所在的书导入失败）。因此实际读出的总量同样不超过 500 MB。
- **路径穿越防护**：导出读图与导入写图均 `normalize()` 后校验 `startsWith(uploadDir)`；条目名统一 `\` → `/`。
- **图片类型**（SEC-04）：归档可能来自他人，所以按字节判断类型，只接受四种位图格式，存储名由 UUID 加检测出的扩展名组成，不包含归档中的任何字符。
- **事务隔离**：每本书独立事务，单本失败不污染整体；图片在事务中写盘、回滚即删除，保证数据库与文件一致。
- **冲突幂等**：基于归一化 `(title, author)` 去重，重复导入不会产生副本。
- **上传大小限制**：`application.properties` 中 `spring.servlet.multipart.max-file-size=200MB`、`max-request-size=220MB`，以容纳多书归档。

## 8. 前端交互

`BookMigrationModal.jsx` 提供 Export / Import 两个 Tab：

- **Export**：列出书库，支持按标题/作者过滤、全选（仅作用于当前过滤结果），调用 `migrationApi.exportBooks` 获取 Blob 并触发浏览器下载。
- **Import**：支持拖拽 / 点击选择多个 `.zip`；每个文件先调 `preview` 展示书数、章节数、图片数、是否含讲解，以及书评/书签/标记/书单数量（v2，仅在非零时显示，文案由 `utils/migrationPreview.js` 生成），并标出冲突；点击导入时逐文件串行调用 `import`，带进度条，最后聚合 `imported / skipped / failed` 汇总。非 zip 文件、重复文件（按 `name+size`）会被过滤。

`migrationApi`（[frontend/src/api.js](../frontend/src/api.js#L139)）封装三个端点，导出从 `Content-Disposition` 解析下载文件名。

## 9. 版本演进注意事项

- 归档以 `formatVersion` 标记（当前 `2`）。新增字段要保持向后兼容：`BookArchiveDto` 等是 record，旧归档缺少的字段反序列化为 `null`，导入时按"没有"处理。
- 新增内容时提升 `FORMAT_VERSION`。导入会拒绝比自己新的版本，避免"导入成功但悄悄丢了新内容"。
- 测试：
  - [MigrationArchiveTest](../backend/src/test/java/com/bookscoreideas/migration/MigrationArchiveTest.java)：v2 往返（导出 → 删除 → 导入 → 再导出必须与原导出完全相同）、v1 归档兼容、拒绝更新版本、预览计数；
  - [ImageApiTest](../backend/src/test/java/com/bookscoreideas/books/ImageApiTest.java)：图片字节往返；
  - [MigrationImageSafetyTest](../backend/src/test/java/com/bookscoreideas/migration/MigrationImageSafetyTest.java)：归档图片按字节判断类型、报告跳过的图片（SEC-04）；
  - [BookJsonExportTest](../backend/src/test/java/com/bookscoreideas/books/BookJsonExportTest.java)：单本 JSON 导出格式不变。
