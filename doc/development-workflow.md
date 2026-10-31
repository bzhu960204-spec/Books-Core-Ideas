# 开发工作约定

> 2026-10-31 整理自改进评审（[improvement-review](improvement-review/README.md)）过程中形成的做法。
> 原则：**数据安全第一**；每个改动都要能证明"修好了"或"没改坏"。

## 1. 数据安全

- `backend/data` 是**真实数据**（H2 库 + 图片）。除正常使用应用外，任何验证都不直接操作它。
- **自动化测试**：使用 `test` profile，每个 Spring 上下文一个随机内存库（`application-test.properties`），图片目录在系统临时目录。
- **手动启动验证**：用临时目录中的库，并用启动参数覆盖：
  `--spring.datasource.url=jdbc:h2:file:<临时目录>/booksdb --app.upload.dir=<临时目录>/images`
  - 端口用 18083/18084（Vite 用 15173），不和日常 dev 的 8080/5173 冲突。
- **dev 带 devtools**：`backend/target/classes` 一变化就会自动重启，并**对真实库执行 Flyway 迁移**。所以在本仓库执行 `mvn`（compile/test/package）之前，先确认 8080 上没有服务在运行。
  - [tools/rehearsal/build-jar.ps1](../tools/rehearsal/build-jar.ps1) `-Ref <提交>` 在临时 git worktree 中构建，不碰 `backend/target`。
- **涉及数据库结构的改动**，按顺序：
  1. 停掉应用（`stop-dev.ps1`）；
  2. 执行 `.\backup-data.ps1 -Label before-<说明>`；
  3. 确认 `backups\` 下出现了新 zip。
  - 数据库确实被打开时脚本会拒绝执行。强杀留下的陈旧锁文件会被自动识别，只给警告（见 [DB-05 补充](improvement-review/03-database-and-data-safety.md#db-05)）。

## 2. 数据库结构（Flyway）

详见 [database-schema-and-flyway.md](database-schema-and-flyway.md)。要点：

- **Flyway 是唯一的 schema 来源**，Hibernate 只做 `validate`。改实体必须同时新增 `V<n>__*.sql`，否则启动（以及所有 Spring 测试）会失败。
- 不修改已执行过的迁移脚本（checksum）。例外：脚本还**从未**在真实库上执行过（只在测试库和临时副本上跑过），且对应提交尚未推送。
- **H2 的 DDL 逐条自动提交**，迁移中途失败会留下半成品。所以：
  - 可能失败的前提条件，在脚本开头用守卫查询检查，**在任何改动之前**中止：`SELECT CAST('V<n> aborted: …' AS INT) AS V<n>_CHECK_xxx FROM … WHERE <异常条件>`。
  - 必须起别名：Flyway 会把每个 SELECT 的（空）结果连同列名打印到日志。
- 命名：`FK_<子表>_<目标>` / `UK_<表>_<列>` / `IDX_<表>_<列>`。外键列先建命名索引再加外键。
- 外键删除规则：所有者 → 被拥有者为 `CASCADE`，`CHAPTER_IMAGES` 为 `RESTRICT`。服务层删除树形数据时要先删子行、再删父行。
- 新迁移要在 `SchemaConvergenceTest` 中保持"老库 = 空库"，必要时为守卫查询加测试。

## 3. 测试要求

- **修复缺陷**：附回归测试，并**先证明不带修复时测试会失败**。做法：先写测试并运行，或临时撤掉修复再运行。
- **行为不变的重构**：写特征测试，要求**改动前后都通过**。
- **查询次数类问题**（N+1、多余加载）：用 Hibernate statistics 断言，测试 profile 已开启 `generate_statistics`。参见 `ChapterApiTest`、`ChapterExplanationLoadingTest`。
- 命令：
  - 后端：`cd backend; mvn test`
  - 前端：`cd frontend; npm.cmd test; npm.cmd run lint; npm.cmd run build`（lint 有任何警告都会失败，CI 中会阻断）
  - 备份/恢复脚本：`powershell -NoProfile -File tools\tests\data-scripts.test.ps1`

## 4. 用真实数据的副本验证（rehearsal）

涉及接口、数据或迁移的改动，在**真实数据的副本**上对比改动前后。工具在 [tools/rehearsal/](../tools/rehearsal/)：

```powershell
$base = .\tools\rehearsal\build-jar.ps1 -Ref HEAD      # 改动前（最后一次提交）
$new  = .\tools\rehearsal\build-jar.ps1                # 改动后（工作区；会重建 backend\target，先确认 8080 空闲）
.\tools\rehearsal\rehearse.ps1 -Label orig                        # 只解压备份并导出各表，作为数据基准
.\tools\rehearsal\rehearse.ps1 -Label before -Jar $base -Port 18083
.\tools\rehearsal\rehearse.ps1 -Label after  -Jar $new  -Port 18084
python tools\rehearsal\compare_api.py    $env:TEMP\bci-rehearsal\before\api  $env:TEMP\bci-rehearsal\after\api
python tools\rehearsal\compare_tables.py $env:TEMP\bci-rehearsal\orig\tables $env:TEMP\bci-rehearsal\after\tables
```

- `rehearse.ps1`：
  - 把最新的备份 zip（可用 `-Backup` 指定）解压到 `%TEMP%\bci-rehearsal\<Label>`，用覆盖参数启动 jar，Flyway 迁移因此会在副本上真实执行一遍；
  - `capture_api.py` 采集全部 GET 接口（含迁移 ZIP 导出的逐条目内容和图片字节的哈希）；
  - 停止应用后，把各表导出为 CSV，并导出 schema。
- `compare_api.py`：逐条比较状态码与 JSON。`compare_tables.py`：按 ID 顺序逐行比较各表。
- 预期**有**变化的改动（例如新增字段）：对比结果中的差异必须全部能解释，并在评审文档中写明。
- **迁移类改动还要检查**：日志中迁移成功；`compare_tables` 各表行数和内容不变。
- 新增 GET 接口时，同步更新 `capture_api.py`。

## 5. 提交与文档

- 每个改进项**单独提交**，使用 Conventional Commits（`fix(scope): …`、`refactor(db): …` 等），正文写清楚原因、做法和验证方式，并加尾注 `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`。
- 完成后更新 `doc/improvement-review` 中对应条目（做了什么、测试、验证结果）和 README 进度表。
- **不推送**，除非明确要求。
- 有设计决策时先列出选项并询问；获得授权"按最佳判断"时，在条目中记录所做的选择及理由。

## 6. 环境备忘（Windows PowerShell 5.1）

- 不支持 `&&`、`||`；用 `;` 加 `if ($?) { … }`。
- `npm` / `npx` 要写成 `npm.cmd` / `npx.cmd`。
- 写文件使用**无 BOM 的 UTF-8**（`[IO.File]::WriteAllText($p, $s, (New-Object Text.UTF8Encoding $false))`）。`.ps1` 文件尽量只用 ASCII 字符：PS 5.1 会把无 BOM 的文件按 ANSI 读取。
- PS 5.1 调用原生程序时会丢弃空字符串参数 `''`。所以 H2 的 `Shell -password ''` 会失效；改用 `RunScript` / `Script` 工具，这两个工具的密码默认为空。
- 直接查询 H2 文件：`java -cp ~/.m2/repository/com/h2database/h2/2.2.224/h2-2.2.224.jar org.h2.tools.RunScript -url jdbc:h2:file:<目录>/booksdb -user sa -script q.sql -showResults`（只对已停止的库或副本操作）。

## 7. 已知的数据现状（2026-10-31）

- 真实库中有 5 条 `chapter_images` 记录（都属于 book 195），但 `backend/data/images/` 为空。对应的图片接口一直返回 404，这次改动前后结果相同。
- `.gitignore` 的注释说明真实数据应通过 junction 指向 OneDrive，而当前 `backend/data` 是普通目录，图片文件可能只保存在另一台机器或 OneDrive 中。属于数据问题，代码无需修改；如需补回图片，请从原始位置复制到 `backend/data/images/`。
