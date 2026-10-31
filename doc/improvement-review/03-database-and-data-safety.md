# 03 · 数据库与数据安全

> 这是一个**个人知识库**：数据本身是最有价值的资产。本页优先级判断以"会不会丢数据 / 能不能恢复"为第一标准。

| ID | 优先级 | 主题 |
|---|---|---|
| DB-01 | 🔴 P0 | Schema 双源管理（Hibernate `ddl-auto=update` + Flyway 补丁） |
| DB-02 | 🟠 P1 | 外键与级联不完整 |
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
> 剩余工作：生产环境切换为 `validate`（需先确认真实库与实体一致，例如 `reading_bookmarks.note` 长度等差异）、补齐 DB-02 外键/级联、给约束起确定的名字。

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

---

<a id="db-03"></a>
## DB-03 · 遗留无用文件 ⚪

> **✅ 已删除（2026-10-31）**，删除后后端全部测试通过。

[migrate.sql](../../backend/src/main/resources/migrate.sql) 不被任何代码加载（不是 Spring 约定的 `schema.sql/data.sql`），内容已被 V1 覆盖，且注释引用了**并不存在**的 `BookReviewSchemaMigration.java`。建议删除，避免误导。

---

<a id="db-04"></a>
## DB-04 · 内联 base64 图片导致数据库膨胀 🟡

[RichTextEditor.jsx](../../frontend/src/components/RichTextEditor.jsx) 允许粘贴/插入图片并以 `data:image/...;base64` 形式内嵌在 HTML 中（单张上限 5MB，`allowBase64: true`），这些 HTML 存入 `chapter_explanations.content` / `book_reviews.content` 等 CLOB 字段。

**后果**：H2 单文件快速增大（base64 比原图大约 33%）；OneDrive 每次同步整个 `.mv.db`；列表/搜索查询扫描 CLOB 变慢；导出 ZIP 时图片重复编码。

**建议**：新增通用图片上传接口（复用 `ImageStorageService`，见 BE-06），编辑器粘贴图片时先上传、再插入 `/api/images/{id}` URL；提供一次性迁移任务把存量 base64 抽取成文件。

---

<a id="db-05"></a>
## DB-05 · 没有备份机制；H2 文件在 OneDrive 同步目录 🟡

> **决定（2026-10-31）**：数据重要性一般，**不做自动/定时备份**，只在大的重构（尤其是 schema 变更）前手动备份。优先级由 P0 调整为 P2。
>
> **已完成**：
> - [backup-data.ps1](../../backup-data.ps1)：把 `backend/data`（数据库 + images）打包为 `backups/data-<时间戳>[-标签].zip`；检测到 H2 `.lock.db`（应用运行中）时拒绝执行，保证快照一致；`-Force` 可绕过陈旧锁文件。
> - [restore-data.ps1](../../restore-data.ps1)：`-Latest` 或 `-BackupFile` 恢复；恢复前自动把当前数据另存为 `*-pre-restore.zip`；支持 `backend/data` 为 junction 的情况（只替换内容，保留 junction）；带 `-Confirm` 确认。
> - `backups/` 已加入 `.gitignore`；主 [README](../../README.md) 增加 "Data Backup & Restore" 章节。
> - 验证：在临时目录上测试了"带锁拒绝 / 标签清洗 / 恢复 / 恢复前安全备份 / junction 恢复"，并确认在运行中的真实数据目录上会拒绝执行。
>
> 下方原始分析中的第 2、4、5 条（在线定时备份、防并发、换存放位置）暂不实施。

**现状**：
- 真实数据（`booksdb.mv.db` + `images/`）通过 junction 指向 OneDrive（[setup-data-link.ps1](../../setup-data-link.ps1)）。OneDrive **不是备份**：损坏的文件同样会被同步覆盖到所有设备。
- 连接串 `AUTO_SERVER=TRUE`，H2 在运行时持续写 `.mv.db`；同步工具在文件被写的同时上传，可能得到不一致的快照或冲突副本（脚本注释已提醒"不要两台机器同时运行"，但仅靠人工约束）。
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

- `book_reviews.updated_at`、`chapter_explanations.updated_at` 是 `DATE`，丢失时分秒，同一天内多次编辑无法排序（目前靠 `id DESC` 兜底）。建议改 `TIMESTAMP`。
- `books.category` 用分号拼接多值（`BookRepository.findDistinctCategories` 在 Java 里拆分）。如果分类会继续增强（重命名、统计），建议拆成 `categories` + 关联表；若保持简单可维持现状。
- `reading_bookmarks.note` 在 V6 中为 `VARCHAR(500)`，实体未声明长度且控制器不截断，超长会 500。
