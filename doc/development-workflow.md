# 开发工作约定

> 2026-10-31 整理自改进评审（[improvement-review](improvement-review/README.md)）过程中形成的做法。
> 原则：**数据安全第一**；每个改动都要能证明"修好了"或"没改坏"。
> 接口约定（状态码、错误格式、请求体）见 [api-conventions.md](api-conventions.md)。

## 1. 数据安全

- `backend/data` 是**真实数据**（H2 库 + 图片）。除正常使用应用外，任何验证都不直接操作它。
- **配置 profile**（BE-09）：`application.properties` 是各环境共用、单独运行也安全的配置（只监听本机、无 H2 Console、无 CORS）；`dev`（start-dev）只多开 H2 Console；`prod`（start-prod）；`test`（自动化测试）。需要 Console 的手动验证加 `--spring.profiles.active=dev`。
- **自动化测试**：使用 `test` profile，每个 Spring 上下文一个随机内存库（`application-test.properties`），图片目录在系统临时目录。
- **手动启动验证**：用临时目录中的库，并用启动参数覆盖：
  `--spring.datasource.url=jdbc:h2:file:<临时目录>/booksdb --app.upload.dir=<临时目录>/images`
  - 端口用 18083/18084（Vite 用 15173），不和日常 dev 的 8080/5173 冲突。
  - 应用只监听 `127.0.0.1`（SEC-03）。脚本和工具访问它时写 `http://127.0.0.1:<端口>`，不要写 `localhost`：在 Windows 上，`localhost` 会先尝试 `::1`，每个请求要多等约 2 秒。浏览器不受影响。
- **dev 带 devtools**：`backend/target/classes` 一变化就会自动重启，并**对真实库执行 Flyway 迁移**。所以在本仓库执行 Maven（`mvnw.cmd` compile/test/package）之前，先确认 8080 上没有服务在运行。
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
- **懒加载的组件和页面**（FE-04）：首次出现时是异步的，测试中用 `findBy…`，不要用 `getBy…`；否则测试会依赖"前面的测试已加载过这个模块"。整页的首次加载给 5 秒左右的超时，但它不能超过测试本身的超时（默认也是 5 秒）：需要更长时（如 `App.test.jsx` 中 10 秒），用 `vi.setConfig({ testTimeout })` 一并放宽。可以用 `npx.cmd vitest run --sequence.shuffle` 检查测试之间是否有顺序依赖。
- **失败场景**（FE-05）：`installFakeBackend({ fail: (method, path) => 500 | 'network' | null })` 让指定请求返回 ProblemDetail 错误或网络失败。要断言 toast，就在被测组件旁一起渲染 `<Toaster />`（toast 用 `role="alert"`），并在 `afterEach` 中调用 `clearToasts()`：toast 存储是模块级状态。
- 命令：
  - 后端：`cd backend; .\mvnw.cmd test`（Maven Wrapper，ENG-04：不需要另装 Maven，版本固定为 3.9.16）
  - 前端：`cd frontend; npm.cmd test; npm.cmd run lint; npm.cmd run build`（lint 有任何警告都会失败，CI 中会阻断）
  - 备份/恢复脚本：`powershell -NoProfile -File tools\tests\data-scripts.test.ps1`
  - start/stop 脚本的公共函数：`powershell -NoProfile -File tools\tests\app-run.test.ps1`

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
- `check_detail.py <api 目录>`：检查每本书的 `GET /api/books/{id}/detail` 是否等于它取代的那些细粒度接口的组合（FE-03）。
- `roundtrip.py <源> <空目标>`：两个实例都要在运行，源用真实数据副本，目标用空库。脚本把全部书分别经 ZIP 迁移和 JSON 导入（FE-08）导入目标，再导出比较。导入相关的改动用它验证。
- 预期**有**变化的改动（例如新增字段）：对比结果中的差异必须全部能解释，并在评审文档中写明。
- **迁移类改动还要检查**：日志中迁移成功；`compare_tables` 各表行数和内容不变。
- 新增 GET 接口时，同步更新 `capture_api.py`。

### 前端改动：新旧版本并排对比

行为不变的前端重构（FE-01 起），在浏览器里把改动前后两个版本**同时**运行、逐场景交替对比，而不是先截基线、改完再截：

```powershell
# 1) 后端：在真实数据副本上运行（rehearse.ps1 只解压并导出，不会一直运行）
.\tools\rehearsal\rehearse.ps1 -Label ui
$r = "$env:TEMP\bci-rehearsal\ui"; $db = ($r -replace '\\', '/') + '/data/booksdb'
java '-Dfile.encoding=UTF-8' -jar <jar> --server.port=18084 "--spring.datasource.url=jdbc:h2:file:$db" "--app.upload.dir=$r\data\images" --spring.h2.console.enabled=false
# 2) 改动前的前端：临时 worktree + 共用 node_modules，Vite 用 15174
git worktree add --detach $env:TEMP\bci-wt-<sha> <sha>
cmd /c mklink /J $env:TEMP\bci-wt-<sha>\frontend\node_modules $PWD\frontend\node_modules
cd $env:TEMP\bci-wt-<sha>\frontend; $env:VITE_API_PROXY_TARGET='http://127.0.0.1:18084'; npx.cmd vite --port 15174 --strictPort
# 3) 当前工作区：同样代理到 18084，Vite 用 15173
```

- 然后在浏览器中运行 [ui-compare.js](../tools/rehearsal/ui-compare.js)（Playwright 片段），它对 5 个主题 × 18 个场景比较 DOM 签名和逐屏截图，返回不一致的场景。
- DOM 签名要包含**文本节点的边界**：`innerHTML` 相同时，文本节点合并或拆分仍会让字形产生次像素偏移。
- 用"滚动窗口、逐屏截图"，不用整页截图：VS Code 内置浏览器的整页截图会以另一个宽度重新布局，结果不可靠。
- Vite 热更新会给脚本加 `?t=` 时间戳，比较前去掉。书库页的封面是外部图片，偶发的不一致重跑即可判断是否只是加载时序。
- 只改样式时，另加一项：`npm run build` 产出的 CSS 与改动前逐字节比较（FE-01 的样式拆分即以此为准）。
- 用完删除 worktree（`git worktree remove --force <路径>`）。

## 5. 提交与文档

- 每个改进项**单独提交**，使用 Conventional Commits（`fix(scope): …`、`refactor(db): …` 等），正文写清楚原因、做法和验证方式，并加尾注 `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`。
- 完成后更新 `doc/improvement-review` 中对应条目（做了什么、测试、验证结果）和 README 进度表。
- **不推送**，除非明确要求。
- 有设计决策时先列出选项并询问；获得授权"按最佳判断"时，在条目中记录所做的选择及理由。

## 6. 环境备忘（Windows PowerShell 5.1）

- 不支持 `&&`、`||`；用 `;` 加 `if ($?) { … }`。
- `npm` / `npx` 要写成 `npm.cmd` / `npx.cmd`。
- **构建环境**（ENG-04）：
  - Java 17+：Maven 的 enforcer 会检查；start-dev / start-prod / build-prod 启动前也会检查（[tools/java-env.ps1](../tools/java-env.ps1)）。`JAVA_HOME` 指向旧版本时，在仓库根放一个 `.java-home` 文件（内容为 JDK 路径，git 已忽略），脚本只在自己的进程中使用它。
  - Node：`frontend/package.json` 的 `engines` 写明支持的版本（`^22.13.0 || ^24.0.0 || >=26.0.0`），`frontend/.nvmrc` 是本机和 CI 使用的版本（24）。`frontend/.npmrc` 设置了 `engine-strict`，版本不符时 `npm install` / `npm ci` 直接拒绝。
  - Maven 的 JVM 警告会写到 stderr，PS 5.1 下退出码可能看起来不对；以 `target/surefire-reports/TEST-*.xml` 为准。
- 脚本中把带空格的命令交给 `cmd /c` 时引号容易出错；启动 `.ps1` 用 `powershell -NoProfile -ExecutionPolicy Bypass -File <脚本> <参数>`，与 `start-*.cmd` 相同。
- 脚本里调用 Node 工具时写 `npm.cmd` / `npx.cmd`，不要写 `npm` / `npx`：后者解析为 `npm.ps1` / `npx.ps1`，在 RemoteSigned 下可能被拒绝执行（ENG-06）。
- `Invoke-WebRequest` 遇到它不认识的媒体类型（如 actuator 的 `application/vnd.spring-boot.actuator.v3+json`）时，`.Content` 是字节数组而不是字符串：请求时带 `Accept: application/json`，或自己解码。
- Vite 不加 `--host` 时监听 `localhost`，Node 17+ 上可能只在 `::1` 上。探测 Vite 用 `http://localhost:<端口>`；后端只监听 IPv4，用 `http://127.0.0.1:<端口>`。
- 在 job 里做阻塞的 .NET 调用（如 `TcpListener.AcceptTcpClient()`）时，`Stop-Job` 无法中断它，会一直挂住；改为轮询（`Pending()`）。
- **start / stop 脚本**（ENG-06）：start-dev / start-prod 把端口、PID 和启动时间写入仓库根的 `.bci-dev-state.json` / `.bci-prod-state.json`；stop-dev / stop-prod 据此停止整个进程树。传 `-Ports` / `-Port` 时改为按端口停止。
- 写文件使用**无 BOM 的 UTF-8**（`[IO.File]::WriteAllText($p, $s, (New-Object Text.UTF8Encoding $false))`）。`.ps1` 文件尽量只用 ASCII 字符：PS 5.1 会把无 BOM 的文件按 ANSI 读取。
- PS 5.1 调用原生程序时会丢弃空字符串参数 `''`。所以 H2 的 `Shell -password ''` 会失效；改用 `RunScript` / `Script` 工具，这两个工具的密码默认为空。
- 直接查询 H2 文件：`java -cp ~/.m2/repository/com/h2database/h2/2.2.224/h2-2.2.224.jar org.h2.tools.RunScript -url jdbc:h2:file:<目录>/booksdb -user sa -script q.sql -showResults`（只对已停止的库或副本操作）。

## 7. 已知的数据现状（2026-10-31）

- 真实库中有 5 条 `chapter_images` 记录（都属于 book 195），但 `backend/data/images/` 为空。对应的图片接口一直返回 404，这次改动前后结果相同。
- `.gitignore` 的注释说明真实数据应通过 junction 指向 OneDrive，而当前 `backend/data` 是普通目录，图片文件可能只保存在另一台机器或 OneDrive 中。属于数据问题，代码无需修改；如需补回图片，请从原始位置复制到 `backend/data/images/`。
