# 03 · 数据库与数据安全

> 这是一个**个人知识库**：数据本身是最有价值的资产。本页优先级判断以"会不会丢数据 / 能不能恢复"为第一标准。

| ID | 优先级 | 主题 |
|---|---|---|
| DB-01 | 🔴 P0 | Schema 双源管理（Hibernate `ddl-auto=update` + Flyway 补丁）（✅ 已完成） |
| DB-02 | 🟠 P1 | 外键与级联不完整（✅ 已完成） |
| DB-03 | ⚪ P3 | 遗留无用文件 `migrate.sql` |
| DB-04 | 🟡 P2 | 富文本内联 base64 图片导致数据库膨胀 |
| DB-05 | 🟡 P2 | 没有备份机制；H2 文件放在 OneDrive 同步目录（✅ 已提供手动备份/恢复脚本） |
| DB-06 | ⚪ P3 | 数据建模细节 |

---

<a id="db-01"></a>
## DB-01 · Schema 双源管理 🔴

**现状**：
- 表结构实际由 Hibernate `ddl-auto=update` 生成；`db/migration/V1..V7` 是"给老库打补丁"的脚本，并且大量使用 `IF NOT EXISTS` 以便与 Hibernate 共存。
- `ddl-auto=update` 只加不改不删：改列类型、加约束、改长度都不会生效（V4 加宽 `summary` 就是因此手写的）。
- 空库启动失败（[BUG-01](01-verified-bugs.md#bug-01)）。
- 现有约束名如 `FKCM2SHIVX19SPBG0FLC47MCRS1` 是 Hibernate 随机生成的，迁移脚本只能硬编码"收割"来的名字。

**目标状态**：Flyway 是唯一 schema 来源，Hibernate 只做 `validate`。

> **进展（2026-10-31）**：短期止血已完成——新增 `V0__base_schema.sql`，空库可启动（BUG-01）；测试 profile 已使用 `ddl-auto=validate`，证明"仅 Flyway"即可得到与实体一致的 schema。
>
> **✅ 已完成（2026-10-31）**：Flyway 成为唯一 schema 来源，生产也改为 `ddl-auto=validate`。
> - 选择**只新增迁移、不改 V0–V7**（不动 checksum，无需 `flyway repair`）。
> - 对比真实库（`SCRIPT NODATA`）与空库（V0–V7）发现的差异：
>   - `CHAPTER_EXPLANATIONS` 的外键/唯一约束名不同（Hibernate 名 vs V3 名/H2 系统名）；
>   - `STRUCTURE_TYPE` 长度 255 vs 20；
>   - `CHAPTER_IMAGES_ENABLED` 有无默认值；
>   - `HIGHLIGHTED` 可空 vs NOT NULL；
>   - 外键列上有重复的系统索引。
> - 新增 [V8__normalize_schema.sql](../../backend/src/main/resources/db/migration/V8__normalize_schema.sql)：
>   - 所有外键/唯一约束/索引改为确定的名字（`FK_<子表>_<目标>` / `UK_` / `IDX_`）；
>   - 外键列先建命名索引再加外键，消除重复索引；
>   - 列类型以真实库为准（`STRUCTURE_TYPE` 255），补默认值；`structure_type`、`chapter_images_enabled`、`highlighted` 改为 NOT NULL；
>   - 外键行为不变（级联留给 DB-02）。
> - H2 的 DDL 逐条自动提交，所以 V8 开头先用守卫查询检查"约束/索引都是已知名字"，**在任何改动之前**中止于未知形状。
> - 实体注解同步：唯一约束名、`nullable=false`、`reading_bookmarks.note` 长度 500。
> - 测试 [SchemaConvergenceTest](../../backend/src/test/java/com/bookscoreideas/migration/SchemaConvergenceTest.java)（3 个，移除 V8 时全部失败）：
>   - 以真实库 V7 结构夹具 [legacy-schema-v7.sql](../../backend/src/test/resources/db/legacy-schema-v7.sql) 为起点迁移，INFORMATION_SCHEMA 与空库**逐项相同**；
>   - 老数据保留，NULL 标志变为 FALSE；
>   - 遇到未知约束时中止且不改动。
> - 真实库副本演练：V8 迁移成功；12 张表逐行一致；改动前后 2,724 个 GET 响应零差异，覆盖新增的迁移 ZIP 导出和图片数据。
> - 已重写 [database-schema-and-flyway.md](../database-schema-and-flyway.md)。
> - 外键/级联见 DB-02。

**建议迁移路径**（需在真实库的**副本**上演练）：
1. 从当前真实库导出完整 DDL（H2 `SCRIPT NODATA`），整理成一份"完整基线"。
2. 新增 `V8__...`：对已有库无害（`IF NOT EXISTS`），对空库能建出全部表——或改造 V1 使其在空库上先建基础表（V1 已对老库执行过，修改已执行脚本会导致 checksum 不一致，需要 `flyway repair` 或改用新版本号，二者择一并记录）。
3. 给约束起**确定的名字**，补齐 DB-02 的外键/级联。
4. `spring.jpa.hibernate.ddl-auto=validate`。
5. 增加两个集成测试：**空库启动** + **用真实库副本启动**。
6. 更新 [database-schema-and-flyway.md](../database-schema-and-flyway.md)（当前内容已与配置矛盾，且含其他机器上的个人路径 `C:\Users\bob.zhu\...`）。

---

<a id="db-02"></a>
## DB-02 · 外键与级联不完整 🟠

| 关系 | 现状 | 问题 |
|---|---|---|
| `book_reviews.book_id → books` | 有 FK、无级联 | 删书 500（BUG-02） |
| `chapter_images.chapter_id → chapters` | 有 FK、无级联 | 删章/删书 500（BUG-03） |
| `book_collection_items.book_id / collection_id` | **无 FK** | 删书留孤儿行（BUG-08） |
| `book_collections.parent_id` | **无 FK** | 依赖服务层 BFS 删除子树 |
| `reading_bookmarks / explanation_marks.book_id` | 有 FK、经由 chapter 级联 | 正常，但同时冗余存了 `book_id`，需保证与 `chapter.book_id` 一致 |

**建议**：JPA 级联与数据库 `ON DELETE CASCADE` 双保险；DDL 统一在 DB-01 的新迁移里落地。

> **✅ 已完成（2026-10-31）**：[V9__foreign_keys_and_cascades.sql](../../backend/src/main/resources/db/migration/V9__foreign_keys_and_cascades.sql)
> - **删除规则**：所有"所有者 → 被拥有者"外键改为 `ON DELETE CASCADE`。JPA 级联保留，实体监听器（删图片文件）仍需经过 JPA。
> - **唯一例外 `chapter_images` 用 `RESTRICT`**：绕过 JPA 的删除（手动 SQL、批量删除）无法删掉带图片的章节/书，从而不会留下孤儿图片文件。
> - **补齐缺失外键**：`book_collection_items.book_id / collection_id`、`book_collections.parent_id`（自引用，级联删除子树）。
> - **NOT NULL**：`parts.book_id`、`chapters.book_id`、`key_ideas / excerpts / chapter_images.chapter_id`。
> - **冗余 `book_id` 由数据库保证一致**：复合外键 `(chapter_id, book_id) → chapters(id, book_id)`（书签、标记）和 `(part_id, book_id) → parts(id, book_id)`（章节所在 Part 必须属于同一本书）。书签/标记原先单独指向 `books` 的外键随之去掉（书由章节决定）。
> - 同 V8，开头用守卫查询检查 NULL、孤儿、book_id 不一致，有违规数据时**在任何改动之前**中止（真实数据无违规）。
> - 实体同步：上述 `@ManyToOne` 改为 `optional = false` + `nullable = false`。
> - **随之修改**：`BookCollectionService.delete` 改为按"子先于父"的顺序删除子树。否则先删父行会让数据库级联删掉子行，Hibernate 随后删子行时影响 0 行而报 500。这个问题由新增的特征测试发现，该测试在改动前后都通过。
> - 测试：
>   - [ForeignKeyConstraintsTest](../../backend/src/test/java/com/bookscoreideas/deletion/ForeignKeyConstraintsTest.java)，7 个，直接用 SQL 验证数据库本身的约束。其中 6 个在 V9 之前失败；图片 RESTRICT 那个在前后都通过（外键原本就是 RESTRICT）。
>   - `DeletionCascadeTest` 新增嵌套书单删除的特征测试。
>   - `SchemaConvergenceTest` 新增"违规数据使 V9 中止且不改动"，去掉守卫时失败。
> - 真实库副本演练：
>   - V8+V9 迁移成功，12 张表逐行一致，2,724 个 GET 响应零差异。
>   - 在迁移后的副本上通过 API 删除 3 本真实的书（含 Part、讲解、图片、书签、书单成员），各表行数按预期减少，无孤儿行；重启时 `validate` 通过。

---

<a id="db-03"></a>
## DB-03 · 遗留无用文件 ⚪

> **✅ 已删除（2026-10-31）**，删除后后端全部测试通过。

`backend/src/main/resources/migrate.sql`（已随 DB-03 删除）不被任何代码加载（不是 Spring 约定的 `schema.sql/data.sql`），内容已被 V1 覆盖，且注释引用了**并不存在**的 `BookReviewSchemaMigration.java`。建议删除，避免误导。

---

<a id="db-04"></a>
## DB-04 · 内联 base64 图片导致数据库膨胀 🟡

[RichTextEditor.jsx](../../frontend/src/components/RichTextEditor.jsx) 允许粘贴/插入图片并以 `data:image/...;base64` 形式内嵌在 HTML 中（单张上限 5MB，`allowBase64: true`），这些 HTML 存入 `chapter_explanations.content` / `book_reviews.content` 等 CLOB 字段。

**后果**：H2 单文件快速增大（base64 比原图大约 33%）；OneDrive 每次同步整个 `.mv.db`；列表/搜索查询扫描 CLOB 变慢；导出 ZIP 时图片重复编码。

**建议**：新增通用图片上传接口（复用 `ImageStorageService`，见 BE-06），编辑器粘贴图片时先上传、再插入 `/api/images/{id}` URL；提供一次性迁移任务把存量 base64 抽取成文件。

> **⏸ 暂缓（2026-11-01，阶段 4.11）：只加内容大小上限，图片外置推迟**
>
> **开工前的盘点**（`before-db06-modeling` 备份的副本）：
> - 真实数据中**没有任何内联图片**：51 条讲解（共 2.6M 字符，最大 13 万）、5 条书评、1,285 条想法、932 条摘录、479 个章节摘要中，`data:image` 和 `<img>` 都是 0。整库 9.3 MB。
> - 只有书评和讲解用富文本编辑器。图片的来源有三个：工具栏"插入图片"、粘贴图片文件（单张 ≤ 5 MB）、从 AI 对话粘贴的 HTML 中"Markdown 卡片"的截图（接受代码块提示后会被替换为文字）。
> - 书评和讲解的正文在服务端没有上限，只受 Jackson 3 的默认限制：单个字符串 1 亿字符，即一次保存最多约 100 MB。
>
> **方案选择**（与用户确认）：
> - A（评审建议的完整方案）：上传接口 + 文件存储、引用跟踪和孤儿清理、迁移归档 v3、讲解导出时重新内联、存量抽取。改动面最大，还要改归档格式。
> - B：编辑器在插入前缩放并重新编码图片，加服务端上限。
> - **C（采用）**：只加服务端上限，记录现状，等真的开始用图片时再做 A 或 B。理由：目前数据里一张图片都没有，A 的成本（含归档格式变更）没有对应的收益；上限可以挡住最坏情况（例如一次粘贴了大量截图）。
>
> **做法**：
> - `ExplanationRequest.content`、`ReviewRequest.content` 加 `@Size(max = 20,000,000)`（[RichTextLimits](../../backend/src/main/java/com/bookscoreideas/dto/RichTextLimits.java)）。讲解的 PUT 原来没有 `@Valid`，这次补上。超过时返回 400：`content: must be at most 20 MB (pasted images take the most space)`。
> - 上限按用户要求定得宽松：约为目前最大正文的 150 倍；两张编辑器允许的最大图片（5 MB，内联后约 6.7 MB）加上文字仍然放得下。
> - 只限制 API 写入。迁移归档导入不检查：归档里是已有的数据，拒绝等于丢数据；归档整体已有 500 MB 的 zip bomb 上限（BE-07）。
>
> **测试**：[InputValidationTest](../../backend/src/test/java/com/bookscoreideas/web/InputValidationTest.java) 新增 5 个：讲解 PUT、书评 POST / PUT 超过上限各一个，以及错误信息的原文，这 4 个改动前都失败（200/201）；正好 20,000,000 字符的边界用例改动前后都通过。后端 228 → 233。
>
> **验证**：
> - 真实数据副本：2,749 个 GET 响应 `--strict` 零差异，各表不变。
> - 浏览器（副本 + Vite）：在讲解编辑器中粘贴 4 张 4.9 MB 的图片（2,746 万字符）后保存：
>   - 提示"Could not save the explanation — content: must be at most 20 MB (pasted images take the most space)"；
>   - 编辑器保持打开，4 张图片都在，库中内容未改变。
>   - 改为粘贴 2 张（1,376 万字符）后可以正常保存。
>
> **何时重新考虑**：书评或讲解中开始出现 `data:image`，或者数据库文件明显变大时，再做方案 A 或 B。检查用的 SQL 见上面的盘点，即 `CONTENT LIKE '%data:image%'`。

---

<a id="db-05"></a>
## DB-05 · 没有备份机制；H2 文件在 OneDrive 同步目录 🟡

> **决定（2026-10-31）**：数据重要性一般，**不做自动/定时备份**，只在大的重构（尤其是 schema 变更）前手动备份。优先级由 P0 调整为 P2。
>
> **已完成**：
> - [backup-data.ps1](../../backup-data.ps1)：把 `backend/data`（数据库 + images）打包为 `backups/data-<时间戳>[-标签].zip`；检测到数据库正在使用时拒绝执行，保证快照一致；~~`-Force` 可绕过陈旧锁文件~~（见下方 2026-10-31 补充）。
> - [restore-data.ps1](../../restore-data.ps1)：`-Latest` 或 `-BackupFile` 恢复；恢复前自动把当前数据另存为 `*-pre-restore.zip`；支持 `backend/data` 为 junction 的情况（只替换内容，保留 junction）；带 `-Confirm` 确认。
> - `backups/` 已加入 `.gitignore`；主 [README](../../README.md) 增加 "Data Backup & Restore" 章节。
> - 验证：在临时目录上测试了"带锁拒绝 / 标签清洗 / 恢复 / 恢复前安全备份 / junction 恢复"，并确认在运行中的真实数据目录上会拒绝执行。
>
> 下方原始分析中的第 2、4、5 条（在线定时备份、防并发、换存放位置）暂不实施。
>
> **补充（2026-10-31，DB-01 开工时发现）：陈旧锁文件导致备份未执行**
> - **经过**：`stop-dev.ps1` 按端口强杀进程，H2 来不及删除 `booksdb.lock.db`。之后执行 `backup-data.ps1 -Label before-db01-db02` 时，脚本把这个陈旧锁当成"应用运行中"而拒绝，没有生成备份，但这一点很容易被忽略。
> - **调查中还发现**：原来的 `-Force` 对**真正运行中**的库也不起作用。H2 进程一直打开着 `.mv.db`，`Compress-Archive` 读不了，失败时还可能留下半个 zip。
> - **修复**：新增共享的 [tools/data-lock.ps1](../../tools/data-lock.ps1)，backup/restore 都使用它。
>   - 判断依据改为"是否有进程打开着 `*.mv.db`"：尝试独占打开，失败即视为在用，**拒绝且没有覆盖开关**。
>   - 只有锁文件、没有进程打开数据库时，视为陈旧锁：给出警告后继续。
>   - `-Force` 仍可传入，但会被忽略并给出警告；压缩失败时删除半成品 zip。
> - **测试**：新增 [tools/tests/data-scripts.test.ps1](../../tools/tests/data-scripts.test.ps1)，6 个场景，在临时目录中运行，修复前有 3 个失败。另外用真实 H2 进程验证：应用运行中拒绝；强杀后陈旧锁被识别并完成备份。

**现状**：
- 真实数据（`booksdb.mv.db` + `images/`）通过 junction 指向 OneDrive（[setup-data-link.ps1](../../setup-data-link.ps1)）。OneDrive **不是备份**：损坏的文件同样会被同步覆盖到所有设备。
- 连接串 `AUTO_SERVER=TRUE`（✅ 已随 [SEC-03 补充](05-security.md#sec-03) 去掉：它会对局域网开放端口；去掉后不再生成锁文件，强杀也不留陈旧锁），H2 在运行时持续写 `.mv.db`；同步工具在文件被写的同时上传，可能得到不一致的快照或冲突副本（脚本注释已提醒"不要两台机器同时运行"，但仅靠人工约束）。
- 仓库中没有任何备份/恢复脚本；迁移 ZIP 也不完整（BE-08）。

**建议**（按投入从小到大）：
1. **启动前自动备份**：`start-dev.ps1` / `start-prod.ps1` 在启动 Java 之前把 `data/` 复制为带时间戳的 zip 到 `data/../backups/`，保留最近 N 份（此时没有进程持有数据库，快照一致）。
2. **在线备份**：后端定时执行 H2 `BACKUP TO 'backups/booksdb-<ts>.zip'`（H2 内置，事务一致），并提供"立即备份"按钮。
3. **恢复演练文档**：写清楚如何从备份恢复（停服 → 替换文件 → 启动），并定期演练一次。
4. **防并发**：启动时检测 `.lock.db` 或在 OneDrive 目录写"占用标记"（含机器名），另一台机器启动时提示。
5. 中长期可考虑把数据库放在本地非同步目录，只把**备份文件**放进 OneDrive。

---

<a id="db-06"></a>
## DB-06 · 数据建模细节 ⚪

- ✅ `book_reviews.updated_at`、`chapter_explanations.updated_at` 是 `DATE`，丢失时分秒，同一天内多次编辑无法排序（目前靠 `id DESC` 兜底）。建议改 `TIMESTAMP`。（2026-11-01 完成，见下文）
- ⏸ `books.category` 用分号拼接多值（`BookRepository.findDistinctCategories` 在 Java 里拆分）。如果分类会继续增强（重命名、统计），建议拆成 `categories` + 关联表；若保持简单可维持现状。（2026-11-01 决定维持现状，理由见下文）
- `reading_bookmarks.note` 在 V6 中为 `VARCHAR(500)`，控制器不截断，超长会 500（实体已在 DB-01 中标注 `length = 500`，仅为与库一致；✅ 超长输入随 BE-05 改为返回 400）。
- ✅ `books.reading_status` 中"未设置"有两种存法：13 本是空串、4 本是 NULL。在把 `readingStatus` 映射为 Java 枚举之前，需要先迁移数据（`''` → NULL）。这会改变这些书在 API 中的输出（`""` → `null`），前端两种情况都当作"未设置"处理（见 BE-05）。（2026-11-01 完成，见下文）
- ✅ **`Chapter.explanation` 反向一对一**（2026-10-31 完成，BE-01 时发现）：
  - **问题**：没有字节码增强时，反向一对一无法懒加载，所以每次加载 `Chapter` 实体（改章节、加想法/摘录、导出等）都会把讲解全文一起读出来。
  - **改法**：从 `Chapter` 中删除该字段，删章/删书时讲解由数据库的 `ON DELETE CASCADE`（V9）删除。原本由服务层显式删除也是一种选择，但级联已经在数据库里了，不需要重复的代码。
  - **确认无副作用**：没有代码使用 `getExplanation()`；也没有任何删除路径会在同一事务里先加载讲解实体（否则数据库级联后 Hibernate 会持有过期对象）。
  - **测试** [ChapterExplanationLoadingTest](../../backend/src/test/java/com/bookscoreideas/books/ChapterExplanationLoadingTest.java)：
    - 改章节 + 加想法 + 加摘录时加载讲解实体 0 次（改动前为 3 次，测试失败）；
    - 删章/删书仍会删除讲解（特征测试，改动前后都通过）。
  - **真实库副本**：2,724 个 GET 响应零差异。

> **✅ 已完成（2026-11-01，阶段 4.10）：编辑时间改为 TIMESTAMP；阅读状态与结构类型改为枚举**
>
> **设计决策**（按"最佳判断"授权，接口格式与归档版本已与用户确认）：
> 1. **只改两个"编辑时间"**：`BOOK_REVIEWS.UPDATED_AT`、`CHAPTER_EXPLANATIONS.UPDATED_AT` 改为 `TIMESTAMP`。书本身的 `DATE_ADDED` / `START_DATE` / `FINISH_DATE` 是用户在表单中选、或由 JSON 导入带来的日历日期，保持 `DATE`。已有的值无法补回时分，迁移后为当天 0 点。
> 2. **接口返回完整的 ISO 日期时间**（如 `2026-11-01T12:47:26.235039`；0 点的旧值为 `2026-06-09T00:00`），与书签、标记的 `createdAt` / `updatedAt` 写法一致。**界面仍只显示日期**（`utils/dates.js` 的 `isoDay`），外观不变，也避免旧数据显示一个并不存在的"00:00"。实体写入时截到微秒（列的精度），保存后的响应与之后读到的值相同。
> 3. **迁移归档保持 v2**：`updatedAt` 改为写日期时间；导入同时接受日期（旧归档，读作当天 0 点）和日期时间。旧版本（f00584c 及以前）导入新归档时，这两类时间解析失败，会被记为导入当天，其余内容不受影响（已实测）。没有升到 v3：v3 会让旧版本拒绝整个归档，代价更大。
> 4. **`readingStatus`**：V10 把 `''` 改为 NULL，Java 端为 `ReadingStatus` 枚举（`@Enumerated(STRING)`），数据库加 `CHECK`。**请求仍接受 `""`**（表示未设置，存为 NULL）：书籍表单、旧的 JSON 导出和旧归档都会发送 `""`。响应和导出中，这 13 本书由 `""` 变为 `null`；前端两者都当作"未设置"。归档中出现未知值时按未设置导入（与 `structureType` 未知值按 `CHAPTERS` 导入的既有做法一致），JSON 导入和 API 仍按 BE-05 返回 400。
> 5. **`structureType` 一并改为枚举**（`StructureType`，数据库加 `CHECK`）：它是 BE-05 暂缓的枚举映射的另一半，数据已全部合法，接口输出不变。各处的 `"PARTS".equals(...)` 改为 `book.isPartsBook()`。
> 6. **分类不拆表**：目前没有重命名、统计等需要独立分类表的功能；拆表会同时改变 API、迁移归档和 JSON 导入/导出三种格式，收益不足以抵消。真实数据只有 9 种分类，`findDistinctCategories` 在 Java 中拆分足够。将来要做分类管理时再拆。另：`category` 同样有 `''` 与 NULL 两种"空"，因为它不映射为枚举，不影响功能，未处理。
>
> **做法**：
> - [V10__modeling_details.sql](../../backend/src/main/resources/db/migration/V10__modeling_details.sql)：
>   - 先用守卫查询检查 `READING_STATUS` / `STRUCTURE_TYPE` 中是否有未知值（如 `'DONE'`、小写 `'parts'`），有则在任何改动之前中止，并在错误中给出列名、值和行数；
>   - 然后 `''` → NULL，加 `CK_BOOKS_READING_STATUS`、`CK_BOOKS_STRUCTURE_TYPE`，两列 `ALTER COLUMN … SET DATA TYPE TIMESTAMP`。
> - 实体：`Book.readingStatus` / `structureType` 为枚举；`BookReview` / `ChapterExplanation` 的 `updatedAt` 为 `LocalDateTime`。请求 DTO 仍是带 `@Pattern` 的字符串（错误信息不变），由服务层用 `ReadingStatus.fromText` / `StructureType.valueOf` 转换。
> - 导入：`BookTreeWriter.parseDateTime` 也接受只有日期的值（当天 0 点），书签和标记的时间同样受益。
> - 前端：书评库卡片、书评阅读弹窗、讲解阅读弹窗三处用 `isoDay` 显示日期。讲解导出（HTML/PDF）本来就用 `new Date()` 解析，日期时间同样适用；在 UTC 以西的时区，旧的纯日期反而会被显示成前一天，现在不会。
>
> **测试**（后端 219 → 228，前端 184 → 189；新增和修改的断言改动前全部失败）：
> - [SchemaConvergenceTest](../../backend/src/test/java/com/bookscoreideas/migration/SchemaConvergenceTest.java)：
>   - 老库（V7 结构）迁移后 `''` → NULL、日期变为 0 点的时间戳；
>   - 有未知阅读状态或结构类型时，V10 在改动前中止（停在 V9，`''` 和 `DATE` 列都未改）；
>   - `SchemaSnapshot` 增加比较时间精度和 CHECK 子句，"老库 = 空库"仍成立。
> - [BookStatusValuesTest](../../backend/src/test/java/com/bookscoreideas/books/BookStatusValuesTest.java)：`""` 存为 NULL、返回 null（新建、更新、"清除状态"、JSON 导入）；数据库拒绝未知值和 `''`；结构类型的接口行为不变（特征测试，改动前后都通过）。
> - [ReadingApiTest](../../backend/src/test/java/com/bookscoreideas/books/ReadingApiTest.java)：编辑时间带时分；同一天内编辑的书评按编辑时间排序，书评库也是（改动前按 id 排在后面）。
> - [MigrationArchiveTest](../../backend/src/test/java/com/bookscoreideas/migration/MigrationArchiveTest.java)：归档往返保留时分；旧归档的纯日期读作 0 点；归档中的 `""`、未知值、null 导入为未设置。
> - 前端：`utils/dates.test.js`；书评库卡片和阅读弹窗、讲解弹窗只显示日期。
>
> **真实数据副本**（先停应用并备份 `before-db06-modeling`）：
> - V10 在副本上执行成功（V7 → V10）。
> - 2,749 个响应中 116 个有差异，全部是预期的两类：
>   - 13 本书的 `readingStatus` `""` → `null`：书、详情、JSON 导出各 13 个，书列表、书单内容各 1 个；
>   - 5 条书评、51 条讲解的 `updatedAt` 加上 `T00:00`：讲解 51 个、书评列表 4 个、书评库 1 个；
>   - 迁移 ZIP 导出中 19 本书兼有上述两类。
>   - 把这两处替换应用到改动前的原始文本后，与改动后**逐字相同**（字段顺序等不变）。
> - 各表：行数和内容不变。只有两张表的 `UPDATED_AT` 由 `2026-06-09` 变为 `2026-06-09 00:00:00`，且全部恰为原日期 0 点。`READING_STATUS` 直接查库确认：NULL 17 本（13 + 4），其余不变。导出的 CSV 不区分 `''` 与 NULL，所以 `compare_tables` 看不出这一项。
> - `roundtrip.py`：ZIP 和 JSON 往返后，除已知的 book 195 缺图片外完全相同。
> - 旧版本 jar 导出的整库归档导入新版本后，与 V10 迁移后的副本完全相同（同样除 book 195 的图片外）。
> - 浏览器（副本 + Vite）：
>   - 书评库、书评阅读弹窗、讲解弹窗都只显示日期；
>   - 编辑一条 6-15 的书评后，它排到最前，显示当天日期；
>   - 书库中 17 本未设置状态的书仍显示"Set status"；设置后再清除，状态回到 null。
