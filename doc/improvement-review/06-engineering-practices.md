# 06 · 工程实践（测试 / CI / 仓库卫生 / 文档 / 脚本）

| ID | 优先级 | 主题 |
|---|---|---|
| ENG-01 | 🔴 P0 | 前后端零测试 |
| ENG-02 | 🟠 P1 | 没有 CI |
| ENG-03 | 🟠 P1 | 仓库卫生：`node_modules` 入库、根目录孤立 package.json、提交信息无意义 |
| ENG-04 | 🟡 P2 | 构建可复现性：无 Maven Wrapper、无 Node 版本约束 |
| ENG-05 | 🟡 P2 | 文档过时或互相矛盾 |
| ENG-06 | ⚪ P3 | 启动/停止脚本的小问题 |

---

<a id="eng-01"></a>
## ENG-01 · 前后端零测试 🔴

> **进展（2026-10-31）**：后端测试骨架已建立——[IntegrationTest](../../backend/src/test/java/com/bookscoreideas/support/IntegrationTest.java) 基类（`@SpringBootTest` + MockMvc + `test` profile，随机内存库、`ddl-auto=validate`），首批 3 个测试覆盖空库/老库迁移。运行：`cd backend; mvn test`。
> 前端：已引入 Vitest + jsdom（`npm test`，配置在 `vite.config.js`）和 `@testing-library/react`（组件测试，FE-02 引入）。现有纯函数测试 `sanitizeHtml`、`markdownPaste`（BUG-11），组件测试 `RichTextEditor`、`ChapterImageViewer`（BUG-12）、各编辑表单、讲解和书评 Modal、`ExcerptReader`、迁移弹窗预览（BE-08），共 41 个；CI 中前端测试为阻断步骤。
> 之后：FE-03 / FE-08 加入 fetch 层假后端（[fakeBackend.js](../../frontend/src/test/fakeBackend.js)）和页面测试；FE-01 拆分前先写了详情页、讲解弹窗、编辑器的特征测试，拆出的纯函数也有了单测。现为 130 个。

**现状**：`backend/src/test` 不存在（虽然 pom 已引入 `spring-boot-starter-test`）；前端没有测试框架。本次发现的 BUG-01~05 都是一个最基础的集成测试就能拦住的。

**建议的最小测试集**（按收益排序）：
1. **后端集成测试**（`@SpringBootTest` + 临时 H2 文件库 + `MockMvc`）：
   - 空库启动成功（BUG-01 回归）；
   - 删除带书评/图片/书签/标记的书与章节（BUG-02/03）；
   - 跨章节修改/删除返回 404（BUG-05）；
   - 迁移导出 → 导入往返后数据一致（BE-08）。
2. **前端单测**（Vitest）：纯函数优先——[linkFix.js](../../frontend/src/utils/linkFix.js)、[explanationAnchor.js](../../frontend/src/utils/explanationAnchor.js)、`RichTextEditor` 中的粘贴/代码块转换函数（✅ FE-01 拆出后：[pasteTransforms.test.js](../../frontend/src/components/richText/pasteTransforms.test.js)）、JSON 导入解析（FE-08，✅ [jsonImport.test.js](../../frontend/src/utils/jsonImport.test.js)）。
3. 后续可加一条 Playwright 冒烟测试（建书 → 加章 → 加想法 → 删除）。

---

<a id="eng-02"></a>
## ENG-02 · 没有 CI 🟠

> **✅ 已完成（2026-10-31）**：[.github/workflows/ci.yml](../../.github/workflows/ci.yml)——push 到 `main` 及 PR 时运行；后端 `mvn -B verify`（JDK 17），前端 `npm ci` → `npm test`（阻断）→ `lint` → `build`（Node 24）。lint 自 FE-02 起改为阻断（`--max-warnings 0`）。
> 验证：actionlint 1.7.12 无告警；在干净 worktree 中原样执行各命令均符合预期（npm ci ✅、build ✅、mvn verify 16/16 ✅）。尚未在 GitHub 上实际运行（需推送后确认）。

仓库没有 `.github/workflows`。

**建议**：一个 GitHub Actions 工作流，在 push/PR 时运行：
```
backend : mvn -B verify                         (JDK 17)
frontend: npm ci && npm run lint && npm test && npm run build   (在 frontend/ 下)
```
配合 FE-06 修正依赖后，这条 CI 本身也能验证"干净 clone 可构建"。

---

<a id="eng-03"></a>
## ENG-03 · 仓库卫生 🟠

> **✅ 已处理（2026-10-31）**：根目录 `node_modules/`（163 个已跟踪文件）、`package.json`、`package-lock.json` 已从工作区删除（提交后即从仓库移除）；`.gitignore` 改为全局忽略 `node_modules/`。提交信息规范需在后续提交中执行。

- **根目录 `node_modules/` 被提交**（163 个文件，jszip 及其依赖）；`.gitignore` 只忽略了 `frontend/node_modules/`。
- 根目录 [package.json](../../package.json) / `package-lock.json` 只为 jszip 存在，应归属 `frontend/`（FE-06）。
- 最近的提交信息全是 `chore: sync from Project Management ...`，无法从历史得知"改了什么、为什么改"，也无法用 `git bisect`/`git log` 定位回归（例如 BUG-01 中 Flyway 被重新开启的那次改动）。

**建议**：
- `git rm -r --cached node_modules package.json package-lock.json`，`.gitignore` 改为全局 `node_modules/`；
- 后续提交采用有意义的信息（如 Conventional Commits：`fix(backend): cascade delete reviews when deleting book`），每个改进项一个提交，便于回溯。

---

<a id="eng-04"></a>
## ENG-04 · 构建可复现性 🟡

- 无 Maven Wrapper（`mvnw`），脚本依赖 PATH 上的 `mvn`；
- `frontend/package.json` 无 `engines`、仓库无 `.nvmrc`；Vite 8 / ESLint 10 对 Node 版本有要求；
- 现有文档提到 Java 版本切换问题（JAVA_HOME 指向 Java 8 导致失败），`start-prod.ps1` 用 `.java-home` 文件绕过，`start-dev.ps1` 却没有同样逻辑。

**建议**：`mvn wrapper:wrapper`；`engines.node` + `.nvmrc`；pom 加 `maven-enforcer-plugin` 要求 Java 17+；`start-dev.ps1` 复用 `.java-home` 逻辑（抽成公共 `scripts/common.ps1`）。

> **✅ 已完成（2026-11-01）**：构建环境固定：Maven 由 Wrapper 下载并校验，Java / Node 版本不符时在第一步就给出明确提示。
>
> **设计决定**（简单项，按最佳判断）
> 1. **Maven Wrapper 放在 `backend/`**（与 pom 同目录），用 `only-script` 类型：不提交 jar（`.gitignore` 本来就忽略它），由 `mvnw` / `mvnw.cmd` 自己下载。
>    - Maven 固定为 3.9.16，与本机相同。
>    - 加了 `distributionSha256Sum`。记录前，先用 Maven Central 和 downloads.apache.org 两处的官方 SHA-512 核对了下载的文件。
>    - start-dev、build-prod、[build-jar.ps1](../../tools/rehearsal/build-jar.ps1) 和 CI 都改用 Wrapper。build-jar 构建没有 Wrapper 的旧提交时，退回 PATH 上的 `mvn`，所以改动前后的对比仍然可用。
> 2. **[.gitattributes](../../.gitattributes)**：`mvnw` 固定 LF、`mvnw.cmd` 固定 CRLF（本机 `core.autocrlf=true`，CRLF 的 `mvnw` 在 sh 下无法运行）；`mvnw` 在 git 中带可执行位，CI 可以直接运行 `./mvnw`。
> 3. **`maven-enforcer-plugin`**：要求 Java `${java.version}`（17）+ 和 Maven 3.6.3+（Spring Boot 3.2 的下限），在 validate 阶段执行，提示中写明 `.java-home` 的用法。插件版本由 Spring Boot parent 管理（3.4.1）。
> 4. **Node**：
>    - `engines.node` 取各依赖要求的交集 `^22.13.0 || ^24.0.0 || >=26.0.0`：Vite 8 要求 `^20.19 || >=22.12`，ESLint 10 / jsdom 29 要求 `^20.19 || ^22.13 || >=24`，Vitest 5 要求 `^22.12 || ^24 || >=26`。
>    - `frontend/.nvmrc` 写 `24`，与本机和 CI 相同。CI 改为读取它（`node-version-file`），版本只写在一处。
>    - `frontend/.npmrc` 设置 `engine-strict=true`：版本不符时 `npm install` / `npm ci` 直接拒绝，而不是只给一条警告，然后在 Vite / Vitest 中报难懂的错误。它同样检查所有依赖的 `engines`，Node 24 上 `npm ci` 通过。
> 5. **脚本选择 Java**：新建 [tools/java-env.ps1](../../tools/java-env.ps1)，像 `tools/data-lock.ps1` 一样点引用。评审建议的 `scripts/common.ps1` 与现有约定不同，所以没有采用；ENG-06 合并端口函数时可以同样放到 `tools/` 下。
>    - `Set-ProjectJavaHome` 应用 `.java-home`；路径无效时直接报错。原来会照样设置，然后悄悄退回 PATH 上的 `java`。
>    - `Assert-ProjectJava` 按 Maven 的规则（先 `JAVA_HOME`，再 PATH）找到 java，读取版本，低于 17 时给出带提示的错误。它返回 java 路径，start-prod 用它运行 jar。
>    - start-dev、start-prod、build-prod 启动前都会检查（原来只有 start-prod 读取 `.java-home`）。start-prod 保持原来的顺序：先应用 `.java-home`，再加载 `.env`，最后检查。
>
> **验证**
> - Wrapper：从空缓存首次运行时下载 3.9.16，`mvnw.cmd -v` 显示 3.9.16 / Java 17。把 SHA-256 改错后，Wrapper 拒绝运行（"Failed to validate Maven distribution SHA-256"）。
> - 后端 200 个测试通过（`mvnw.cmd test`）；前端 184 个测试通过，lint 0 / 0，build 正常。
> - 用临时下载的 JRE 11 作为 `JAVA_HOME`：
>   - start-dev、start-prod、build-prod 都在启动任何东西之前停下，提示 "Java 11 found (…), but the backend needs Java 17 or newer. …"；
>   - `.java-home` 指向 JDK 17 后检查通过；指向不存在的目录时报错；
>   - Maven：改动前的错误是 "No compiler is provided in this environment. Perhaps you are running on a JRE rather than a JDK?"，改动后 enforcer 报 "Java 17 or newer is required…"。
> - 用临时下载的 Node 20：`npm ci` 报 `EBADENGINE`，写明要求的版本和实际版本。
> - 端到端：
>   - 用 `start-dev.cmd` 的启动方式在临时库上运行（用环境变量覆盖库和图片目录；测试进程独占打开真实库文件作为保险，真实库未被改动）。后端经 Wrapper 启动，空库迁移到 V9，dev profile 生效（Console 200）；经 Vite 代理的 `/api/books` 为 200。
>   - start-prod 在临时库上运行：页面和 API 都是 200，Console 404。
>   - build-prod 正常生成 jar 和 dist；build-jar 构建改动前的提交（无 Wrapper）正常。
> - 顺带发现（交给 ENG-06）：直接运行 `.\start-dev.ps1`（README 写的第二种方式）时，前端起不来，而且没有任何提示。原因见 ENG-06。

---

<a id="eng-05"></a>
## ENG-05 · 文档过时或互相矛盾 🟡

- [README.md](../../README.md)：
  - 写 "React 18"，实际是 React 19；
  - 只介绍 JSON 导入格式，没有功能概览（书单、讲解、讲解标记、阅读历史、书评库、迁移、prod 单端口模式、OneDrive 数据链接）；
  - 没有"环境要求 / 首次安装 / 数据备份与恢复"章节；
  - 书库导入 excerpts 的说明与实际行为不符（BUG-06）。（✅ 随 FE-08 修复，README 导入说明已同步）
- [database-schema-and-flyway.md](../database-schema-and-flyway.md)：~~声称 Flyway 已关闭，与配置矛盾；含个人机器路径~~ ✅ 已随 BUG-01 重写。
- [migration-feature.md](../migration-feature.md)：~~未说明归档不含书评/书签/标记/书单（BE-08）~~ ✅ 随 BE-08 更新为 v2，写明了归档范围。
- `doc/` 没有索引页。

**建议**：README 重写为"简介 → 功能 → 快速开始 → 环境要求 → 数据与备份 → 文档索引"，JSON 导入格式移到 `doc/json-import-format.md`；`doc/README.md` 做索引。

---

<a id="eng-06"></a>
## ENG-06 · 启动/停止脚本的小问题 ⚪

- `stop-dev.ps1` 按端口（8080/5173）强杀进程：若 start-dev 因端口占用而自动换了端口，stop-dev 会杀错进程或杀不到（start-prod 已用 `.bci-prod-state.json` 记录实际端口，dev 可借鉴）。强杀还会让 H2 留下陈旧的 `booksdb.lock.db`；~~这曾让备份脚本误判"应用运行中"而拒绝~~（✅ 2026-10-31 已修复：备份/恢复脚本改为检测数据库文件是否真的被打开，见 [DB-05 补充](03-database-and-data-safety.md#db-05)；✅ 2026-11-01 根源也已去掉：锁文件只在 `AUTO_SERVER` 下才会生成，[SEC-03 补充](05-security.md#sec-03) 去掉了它）。
- 启动就绪检测靠"端口在监听"，不代表应用已可用；可引入 `spring-boot-starter-actuator` 的 `/actuator/health`（仅暴露 health）。
- `start-dev.ps1` 与 `start-prod.ps1` 中端口探测函数重复实现两遍。
- **（2026-11-01，ENG-04 验证时发现）直接运行 `.\start-dev.ps1` 时前端静默起不来**：
  - 前端 job 调用 `npx`，在 PowerShell 中解析为 Node 自带的 `npx.ps1`。本机的执行策略是 RemoteSigned，而 Node 是从网上下载的 zip 解压的，所以 `npx.ps1` 被拒绝执行。
  - `start-dev.cmd` 用 `-ExecutionPolicy Bypass` 启动，job 继承了这个策略，所以不受影响；README 写的第二种方式 `.\start-dev.ps1` 会出这个问题。
  - 另外，`Receive-Job -ErrorAction SilentlyContinue` 把 job 的错误吞掉了，界面上只会反复显示 "[!] Frontend process stopped unexpectedly."，看不到原因。
  - 建议：改用 `npx.cmd`，并显示 job 的错误。
