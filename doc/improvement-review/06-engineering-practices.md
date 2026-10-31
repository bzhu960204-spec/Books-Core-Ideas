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

**现状**：`backend/src/test` 不存在（虽然 pom 已引入 `spring-boot-starter-test`）；前端没有测试框架。本次发现的 BUG-01~05 都是一个最基础的集成测试就能拦住的。

**建议的最小测试集**（按收益排序）：
1. **后端集成测试**（`@SpringBootTest` + 临时 H2 文件库 + `MockMvc`）：
   - 空库启动成功（BUG-01 回归）；
   - 删除带书评/图片/书签/标记的书与章节（BUG-02/03）；
   - 跨章节修改/删除返回 404（BUG-05）；
   - 迁移导出 → 导入往返后数据一致（BE-08）。
2. **前端单测**（Vitest）：纯函数优先——[linkFix.js](../../frontend/src/utils/linkFix.js)、[explanationAnchor.js](../../frontend/src/utils/explanationAnchor.js)、`RichTextEditor` 中的粘贴/代码块转换函数（拆出后，见 FE-01）、JSON 导入解析（FE-08）。
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

---

<a id="eng-05"></a>
## ENG-05 · 文档过时或互相矛盾 🟡

- [README.md](../../README.md)：
  - 写 "React 18"，实际是 React 19；
  - 只介绍 JSON 导入格式，没有功能概览（书单、讲解、讲解标记、阅读历史、书评库、迁移、prod 单端口模式、OneDrive 数据链接）；
  - 没有"环境要求 / 首次安装 / 数据备份与恢复"章节；
  - 书库导入 excerpts 的说明与实际行为不符（BUG-06）。
- [database-schema-and-flyway.md](../database-schema-and-flyway.md)：~~声称 Flyway 已关闭，与配置矛盾；含个人机器路径~~ ✅ 已随 BUG-01 重写。
- [migration-feature.md](../migration-feature.md)：~~未说明归档不含书评/书签/标记/书单（BE-08）~~ ✅ 随 BE-08 更新为 v2，写明了归档范围。
- `doc/` 没有索引页。

**建议**：README 重写为"简介 → 功能 → 快速开始 → 环境要求 → 数据与备份 → 文档索引"，JSON 导入格式移到 `doc/json-import-format.md`；`doc/README.md` 做索引。

---

<a id="eng-06"></a>
## ENG-06 · 启动/停止脚本的小问题 ⚪

- `stop-dev.ps1` 按端口（8080/5173）强杀进程：若 start-dev 因端口占用而自动换了端口，stop-dev 会杀错进程或杀不到（start-prod 已用 `.bci-prod-state.json` 记录实际端口，dev 可借鉴）。强杀还会让 H2 留下陈旧的 `booksdb.lock.db`；~~这曾让备份脚本误判"应用运行中"而拒绝~~（✅ 2026-10-31 已修复：备份/恢复脚本改为检测数据库文件是否真的被打开，见 [DB-05 补充](03-database-and-data-safety.md#db-05)）。
- 启动就绪检测靠"端口在监听"，不代表应用已可用；可引入 `spring-boot-starter-actuator` 的 `/actuator/health`（仅暴露 health）。
- `start-dev.ps1` 与 `start-prod.ps1` 中端口探测函数重复实现两遍。
