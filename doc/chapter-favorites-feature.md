# 收藏章节（Favorite Chapters）

> 2026-11-27 新增。把讲解（Explanation）值得反复读的章节加星，书多了以后在侧栏「⭐ Favorite Chapters」页跨书找回。
> 与 [讲解片段收藏](explanation-marks/implementation.md)（marks，收藏讲解中的一段文字、只在本书内查看）和阅读书签（Reading History，记录读到哪里）相互独立：这里收藏的是**整章**。

## 1. 交互

- **阅读器底栏**：查看讲解时，`🔖 Mark read here` 左边有 `☆ Favorite` / `★ Favorited` 切换按钮（`aria-pressed`）。
- **书详情页章节行**：📄 按钮左边有 ☆ / ★。只在有讲解的章节上显示；已收藏的章节即使讲解后来被删除，也照样显示 ★，方便取消。
  - 两处同步：点击后星标立即变化（先改页面缓存），请求失败时恢复原状并弹出 toast。
- **⭐ Favorite Chapters 页**（`/favorites`，侧栏在 Collections 下面）：
  - 工具栏：搜索框（章节标题与摘要、书名、作者、收藏备注，大小写不敏感，在服务器端搜索）、`BookPicker` 按书筛选、排序（`Recently added` 最近收藏在前 / `By book` 按书名分组，组内按章节顺序）。
  - 卡片：`书名 · 作者`、章节号与标题、摘要（最多两行）、收藏备注、收藏日期；讲解已删除时标出 `No explanation`。
  - 点击卡片：跳到该书并直接打开这一章的讲解（沿用 Reading History 的 `state.openExplanation`）。
  - ✏️：在卡片里编辑备注（≤500 字），说明这一章为什么值得反复读；★：取消收藏（先确认）。

## 2. 设计决定（"按最佳判断"做出的选择）

| 问题 | 选择 | 理由 |
|---|---|---|
| 组织方式 | 平铺列表 + 按书筛选 + 搜索 + 两种排序 | 用户明确选择先做简单版；标签/文件夹以后可以在同一张表上加 |
| 数据放在哪 | 独立的 `CHAPTER_FAVORITES` 表，不在 `CHAPTERS` 上加列 | 收藏有自己的备注和时间；`Chapter` 已经很重；表级的外键级联负责清理 |
| 备注 | 支持，可选 | 只看标题时，很难记起为什么收藏了这一章 |
| 收藏入口 | 阅读器底栏 + 章节行 | 读到好内容时就在阅读器里；整理时在章节行 |
| 没有讲解的章节 | 不显示收藏按钮 | 这个功能针对的是讲解；已收藏的章节讲解被删后仍可取消 |
| 删除讲解 | **不**取消收藏 | 收藏挂在章节上；讲解经常被重写（删除再写），不应因此丢失收藏 |
| ZIP 迁移 | 带上收藏（含备注和原始时间），不升格式版本 | 字段可空，新旧版本互相兼容（见 [migration-feature.md](migration-feature.md) 第 4 节） |
| 取消收藏的幂等性 | 未收藏时 `DELETE` 也返回 204 | 星标是开关，连点或两个页面同时操作都不应报错 |

## 3. 数据模型

[V12__add_chapter_favorites.sql](../backend/src/main/resources/db/migration/V12__add_chapter_favorites.sql)，实体 [ChapterFavorite](../backend/src/main/java/com/bookscoreideas/entity/ChapterFavorite.java)：

| 列 | 说明 |
|---|---|
| `ID` | 主键 |
| `BOOK_ID` | 冗余存放，用于按书筛选（`IDX_CHAPTER_FAVORITES_BOOK`） |
| `CHAPTER_ID` | `UK_CHAPTER_FAVORITES_CHAPTER`：每章最多收藏一次 |
| `NOTE` | VARCHAR(500)，可空 |
| `CREATED_AT` | TIMESTAMP(6)；导入时保留原值 |

外键 `FK_CHAPTER_FAVORITES_CHAPTER (CHAPTER_ID, BOOK_ID) → CHAPTERS (ID, BOOK_ID) ON DELETE CASCADE`，与书签、标记相同：`BOOK_ID` 必须与章节所属的书一致，删章、删 Part、删书时数据库自动删除收藏。`Chapter` 实体上没有映射收藏（和讲解一样），JPA 删除章节时同样由数据库级联。

## 4. 接口

[ChapterFavoriteController](../backend/src/main/java/com/bookscoreideas/controller/ChapterFavoriteController.java) / [FavoriteService](../backend/src/main/java/com/bookscoreideas/service/FavoriteService.java)：

| 方法 & 路径 | 说明 |
|---|---|
| `PUT /api/chapters/{chapterId}/favorite` | 收藏（upsert），返回 200 + `FavoriteDto`。body 可选：`{ note }`。`note` 缺省或为 null 时保留原备注（再次加星不会清掉备注）；其他值替换备注，空白表示清空；超过 500 → 400；章节不存在 → 404 |
| `DELETE /api/chapters/{chapterId}/favorite` | 取消收藏，204（幂等）；章节不存在 → 404 |
| `GET /api/favorites?bookId=&q=` | 收藏列表，最近收藏在前；`bookId`、`q` 可选，筛不到时返回 200 `[]`。一次连接查询，条数多少都是同样的查询次数 |

`FavoriteDto`：`id, chapterId, chapterTitle, chapterOrderIndex, chapterSummary, hasExplanation, bookId, bookTitle, bookAuthor, bookCoverUrl, note, createdAt`。

书详情聚合接口 `GET /api/books/{id}/detail` 的每个章节多一个 `favorite`（布尔），等于该章是否在 `GET /api/favorites?bookId={id}` 中（[check_detail.py](../tools/rehearsal/check_detail.py) 会核对）。

## 5. 前端

| 文件 | 内容 |
|---|---|
| [api.js](../frontend/src/api.js) | `favoriteApi`：`add(chapterId, note?)`、`remove(chapterId)`、`list({ q, bookId })` |
| [queries.js](../frontend/src/queries.js) | `useFavorites(params)`（`keepPreviousData`，输入时不闪空） |
| [FavoritesPage.jsx](../frontend/src/pages/FavoritesPage.jsx) | 收藏页；样式在 [banks.css](../frontend/src/styles/banks.css) 的 `.favorite-*` |
| [BookDetailPage.jsx](../frontend/src/pages/BookDetailPage.jsx) | `handleToggleFavorite`：先改缓存，失败时恢复并提示，最后 `refresh()` |
| [ChapterCard.jsx](../frontend/src/pages/bookDetail/ChapterCard.jsx) | 章节行的 ☆ / ★ |
| [ExplanationFooter.jsx](../frontend/src/components/explanation/ExplanationFooter.jsx) | 阅读器底栏按钮；`ChapterExplanationModal` 透传 `favorite` / `onToggleFavorite` |
| [migrationPreview.js](../frontend/src/utils/migrationPreview.js) | 导入预览显示 `N favorites` |

## 6. 测试与验证

- 后端（`cd backend; .\mvnw.cmd test`，共 242 个测试通过）：
  - `ReadingApiTest.favoriteChapters`：upsert 与备注规则、长度限制、排序、按书筛选、搜索、幂等取消、404；`historyListsDoNotQueryPerRow` 覆盖列表的查询次数。
  - `BookDetailApiTest`：`favorite` 标志与 `/favorites` 一致，详情的查询次数不随章节增长。
  - `MigrationArchiveTest`：收藏（备注、原始时间）经导出 → 删除 → 导入 → 再导出完全相同；预览计数 `favoriteCount`。
  - `ForeignKeyConstraintsTest` / `DeletionCascadeTest`：SQL 删书与 API 删书都会清除收藏；`BOOK_ID` 与章节不一致时被拒绝。
  - `ApiConventionsTest` / `InputValidationTest`：404、筛选为空时返回 200 `[]`、`note` 501 字符被拒（400），500 字符可以。
  - `SchemaConvergenceTest`：老库与空库迁移到 V12 后结构仍然完全相同。
- 前端（`npm.cmd test`、`lint`、`build`）：`FavoritesPage.test.jsx`（列表、按书分组、打开讲解、编辑备注、取消收藏、搜索参数），`BookDetailPage.behavior.test.jsx`（章节行与阅读器的星标、两处同步），`BookDetailPage.failures.test.jsx`（失败时恢复星标并提示）。`RichTextEditor.test.jsx` 中"drops pasted images over 5 MB"在本机超时，改动前的提交上同样失败，与本功能无关。
- 在真实数据副本上演练（第 7 节所述情况之后的备份 `data-20261127-213511-before-chapter-favorites.zip`）：
  - `compare_tables`：12 张原有表逐行一致。
  - `compare_api`：4827 个响应中有 124 个不同，全部是预期的差异：41 个 detail 的每章 `favorite`（共 822 个，全为 `false`）、41 个迁移导出的每章 `favorite`（822 个，全为 `null`）、42 个 `/favorites` 响应（以前是 404，现在是 200 `[]`）。把这些差异从改动后的结果中去掉，剩下 4785 个响应与改动前完全相同。
  - `check_detail`：41 本书的 detail 与细粒度接口（含 `/favorites`）一致。
  - 手动：在副本上用浏览器加星（章节行、阅读器）、在收藏页写中文备注、按备注搜索、点击卡片打开讲解。

## 7. 事故记录：V12 提前在真实库上执行

开发期间 `start-dev` 一直在运行（Maven `spring-boot:run` + devtools）。VS Code 的 Java 扩展会把源码和资源**自动编译到 `backend\target\classes`**，其中包括新的 `V12__add_chapter_favorites.sql`。devtools 发现变化后重启应用，Flyway 于 2026-11-27 21:15:36 在真实库上执行了 V12（成功）。之后才按约定做了备份，所以备份里已经包含 V12。

影响：V12 只新建一张空表和它的索引、外键，没有修改任何已有的表或数据；校验时新代码确认库中 V12 的 checksum 与最终脚本相同。旧版代码在这个库上仍能启动（Flyway 只提示库版本较新）。

预防：开发数据库结构时，先停掉 `start-dev`（`stop-dev.ps1`），再新建迁移脚本；不能只在执行 Maven 前才停。已补充到 [development-workflow.md](development-workflow.md) 第 1 节。
