# 项目改进评审（Improvement Review）

> 评审日期：2026-10-31 ｜ 范围：后端、数据库、前端、安全、工程实践 ｜ 状态：**待逐项改进**
>
> 本目录用于记录 Books-Core-Ideas 的全面评审结果，并作为后续"一步步改进"的**任务清单与进度追踪**。
> 每完成一项，就在下方追踪表中更新状态，并在对应条目下补充"已完成：做了什么 / 提交号"。
> 改进过程中遵循的约定（数据安全、迁移、测试、真实数据副本验证、提交）见 [../development-workflow.md](../development-workflow.md)。

## 文档结构

| 文件 | 内容 |
|---|---|
| [01-verified-bugs.md](01-verified-bugs.md) | 已实测复现 / 代码确认的缺陷（BUG-xx） |
| [02-backend-architecture.md](02-backend-architecture.md) | 后端架构与代码质量（BE-xx） |
| [03-database-and-data-safety.md](03-database-and-data-safety.md) | 数据库 schema、外键、备份与数据安全（DB-xx） |
| [04-frontend.md](04-frontend.md) | 前端结构、数据获取、性能、体验（FE-xx） |
| [05-security.md](05-security.md) | 安全（SEC-xx） |
| [06-engineering-practices.md](06-engineering-practices.md) | 测试、CI、仓库卫生、文档、脚本（ENG-xx） |

## 评审方法

- 通读后端全部源码、迁移脚本、配置与启动脚本；前端核心页面与组件（重点是大文件与数据流）。
- 运行 `npm run lint`（31 errors / 3 warnings）与 `npm run build`（单 chunk 1.19MB）。
- 在**临时目录的独立 H2 库**上启动后端（端口 18080，未触碰 `backend/data` 真实数据），用 HTTP 请求复现可疑问题。标记为"✅ 实测"的条目均已复现。

## 总体评价

**做得好的地方**（改进时应保留）：
- 功能完整且贴合个人阅读工作流：书 → Part → 章 → 想法/摘录/讲解/标记/书签，配合书单、书评库、阅读历史。
- 代码注释质量高，大量"为什么这样做"的说明；已有多份功能设计文档。
- 迁移导入有不错的防护意识：单书事务、提交后再写图片、zip bomb 上限、路径穿越校验。
- 开发/生产两套一键脚本，prod 单端口模式与端口自动回退做得细致。

**主要问题**集中在四类：
1. **可恢复性**：空库无法启动、迁移归档不完整、（原先）没有备份手段。
2. **数据完整性**：删除级联缺失（删书/删章 500）、子资源无归属校验。
3. **可维护性**：无测试、无 CI、超大组件、API 风格不一、实体直出。
4. **性能与体验**：列表接口返回整库内容、详情页 N+1 请求、1.2MB 单包、错误静默吞掉。

## 推荐改进路线

> 原则：**先止血、再建安全网、后重构**。每阶段的改动都先有测试兜底再动手。

### 阶段 0 · 止血（数据安全 + 致命缺陷）
| 顺序 | ID | 事项 |
|---|---|---|
| 0.1 | DB-05 | ✅ 手动备份/恢复脚本（大的重构前执行 `backup-data.ps1`） |
| 0.2 | BUG-01 / DB-01(短期) | ✅ 空库可启动 |
| 0.3 | BUG-02 / BUG-03 / BUG-08 | ✅ 删除级联：书评、章节图片（含文件）、书单成员 |
| 0.4 | BUG-04 | ✅ CORS 加 PATCH + Vite 代理 |
| 0.5 | ENG-03 / FE-06 | ✅ 清理入库的 `node_modules`，jszip 归位 |

### 阶段 1 · 安全网
| 顺序 | ID | 事项 |
|---|---|---|
| 1.1 | ENG-01 | 后端集成测试骨架 + 阶段 0 的回归测试 |
| 1.2 | ENG-02 | ✅ GitHub Actions CI |
| 1.3 | FE-02 | ✅ ESLint 清零（CI 阻断，含警告） |
| 1.4 | BE-04 / BUG-07 | ✅ 全局异常处理（ProblemDetail） |
| 1.5 | BUG-05 | ✅ 子资源归属校验 |

### 阶段 2 · 后端结构与数据
| 顺序 | ID | 事项 |
|---|---|---|
| 2.1 | BE-02 | ✅ `GET /api/books` 瘦身 + 引入 DTO |
| 2.2 | BE-01 / BE-06 | ✅ Service 层（含 open-in-view=false）、✅ 图片存储统一；统一导出推迟到 BE-08 |
| 2.3 | DB-01 / DB-02 | ✅ Flyway 成为唯一 schema 来源，`ddl-auto=validate`（DB-01）；✅ 补外键与级联（DB-02） |
| 2.4 | BE-08 | ✅ 迁移归档 v2：补齐书评/书签/标记/书单 |
| 2.5 | BE-05 / BE-03 | ✅ 校验、API 风格统一（枚举映射因数据中有 '' 暂缓，已在 DB-06 完成） |

### 阶段 3 · 前端
| 顺序 | ID | 事项 |
|---|---|---|
| 3.1 | SEC-01 | ✅ DOMPurify 清洗富文本 |
| 3.2 | FE-03 / FE-08 / BUG-06 | ✅ 聚合接口 + 数据层（TanStack Query）+ 后端 JSON 导入（顺带修复新发现的 BUG-14） |
| 3.3 | FE-01 | ✅ 拆分 BookDetailPage / RichTextEditor / ChapterExplanationModal / index.css（行为不变；顺带发现 BUG-15、BUG-16） |
| 3.4 | FE-04 | ✅ 路由与重组件懒加载（首屏 JS 1,249→311 KB；顺带修复懒加载后编辑器被提前销毁的问题） |
| 3.5 | FE-05 | ✅ Toast、ErrorBoundary、404、统一确认框（顺带发现并修复 BUG-17、BUG-18、BUG-19） |

### 阶段 4 · 加固与收尾
按以下顺序进行（2026-11-01 确认）：

| 顺序 | ID | 事项 |
|---|---|---|
| 4.1 | SEC-03 | ✅ 仅监听本机（127.0.0.1，Vite 去掉 `--host`）；prod profile 关闭 H2 Console |
| 4.2 | BE-09 | ✅ 配置分环境：默认即安全，dev / prod profile，CORS 显式开启 |
| 4.3 | SEC-02 | ✅ 图片类型白名单 + 魔数校验、`nosniff`、`ContentDisposition` |
| 4.4 | BUG-10 | ✅ 图片上传序号 / 失败上报（同一方法，紧跟 SEC-02） |
| 4.5 | SEC-04 | ✅ 迁移导入复用 SEC-02 的白名单，扩展名白名单 |
| 4.6 | BE-07 | ✅ 导入改为临时文件 + `ZipFile`，不再整包读入内存 |
| 4.7 | ENG-04 | ✅ Maven Wrapper、Node/Java 版本约束（为 BE-10 固定构建环境） |
| 4.8 | ENG-06 | ✅ 脚本：dev 端口记录、健康检查、去重 |
| 4.9 | BE-10 | ✅ 升级 Spring Boot（先 3.5.x 清理弃用，再 4.x） |
| 4.10 | DB-06 | ✅ DATE→TIMESTAMP、`readingStatus` 的 `''`→NULL 与枚举（`structureType` 一并改为枚举；分类不拆表） |
| 4.11 | DB-04 | ⏸ 内联 base64 图片：真实数据中为 0，按方案 C 只加正文大小上限（20 MB），图片外置推迟 |
| 4.12 | FE-07 | api.js 样板 |
| 4.13 | ENG-05 | 文档收尾（依赖前面各项的最终状态） |

## 进度追踪

状态：⬜ 待办 ｜ 🔄 进行中 ｜ ✅ 完成 ｜ ⏸ 暂缓 ｜ ❌ 不做

| ID | 优先级 | 标题 | 阶段 | 状态 | 备注 |
|---|---|---|---|---|---|
| BUG-01 | P0 | 空库无法启动 | 0 | ✅ | V0 基线脚本 + 迁移测试；已在真实库副本验证 |
| BUG-02 | P0 | 删除带书评的书 500 | 0 | ✅ | Book.reviews 级联 + BookService |
| BUG-03 | P0 | 删除带图片的章节 500 / 图片不清理 | 0 | ✅ | Chapter.images 级联 + 提交后删文件 |
| BUG-04 | P1 | CORS 缺 PATCH | 0 | ✅ | 补 PATCH + Vite 代理同源 + CorsConfigTest |
| BUG-05 | P1 | 子资源归属校验 | 1 | ✅ | 404/400 + ParentOwnershipTest |
| BUG-06 | P1 | 书库导入丢 excerpts | 3 | ✅ | 随 FE-08：导入移到后端单事务接口；JsonImportApiTest + LibraryPage.test（旧代码根本没有发出 excerpts） |
| BUG-07 | P2 | 404/400 被当成 500 | 1 | ✅ | 随 BE-04 |
| BUG-08 | P2 | 删书后书单成员残留 | 0 | ✅ | 删书时同事务清除成员行 |
| BUG-09 | P1 | POST 带 id 500 / 静默覆盖 | 2 | ✅ | 随 BE-02 请求 DTO；严重度由 P3 上调（无 500 时会直接覆盖）；BookRequestTest |
| BUG-10 | P3 | 图片上传序号/吞异常 | 4 | ✅ | 序号接在最大值之后（另发现：删除后再上传会重复）；上传报告 `{images, skipped}`（201/200）；写失败记日志并报告、删半个文件；回滚不留文件；超长文件名截断；前端 toast 列出跳过的文件；回归测试 8 个（修复前失败）；副本零差异；浏览器验证 |
| BUG-11 | P2 | Markdown 粘贴代码块不转换 | — | ✅ | 评审后发现；公式改用 marked 扩展 + markdownPaste.test.js |
| BUG-12 | P2 | 删除最后一张章节图片后崩溃 | — | ✅ | FE-02 中由 exhaustive-deps 警告发现；ChapterImageViewer.test.jsx |
| BUG-13 | P1 | 子资源新建带 id 会覆盖/挪走数据 | 2 | ✅ | BUG-09 同源（章节/Part/想法/摘录）；ChildCreateIgnoresClientIdTest |
| BUG-14 | P1 | PARTS 书未分组章节在导出/迁移中丢失 | 3 | ✅ | 设计 FE-08 时发现；归档与 JSON 导出补上顶层 chapters（无此类章节时输出不变）；真实数据零差异 + 往返验证 |
| BUG-15 | P3 | 撤销保存段落失败时无提示 | — | ✅ | FE-01 写特征测试时发现；失败时恢复提示条，错误可见且可重试；回归测试 + 浏览器验证（模拟 500） |
| BUG-16 | P2 | 字体/字号/颜色控件无效 | — | ✅ | FE-01 写特征测试时发现；注册只匹配这三种样式的 TextStyle + 粘贴时按文本去掉这些声明：控件生效，粘贴结果不变（特征测试修复前后都通过） |
| BUG-17 | P2 | 书评保存失败却退出编辑 | — | ✅ | FE-05 盘点时发现；页面报告后再抛出，弹窗留在编辑状态、草稿保留；页面级回归测试（修复前失败）+ 浏览器验证（拦截 PUT 返回 500） |
| BUG-18 | P2 | 讲解打开失败时以空白编辑器打开 | — | ✅ | FE-05 盘点时发现；读取失败只报告、不打开阅读器（204 仍打开空白编辑器）；直接打开和阅读历史深链接各一个回归测试（修复前失败）+ 浏览器验证 |
| BUG-19 | P2 | 加载失败显示成空状态 | — | ✅ | FE-05 盘点时发现；书库、书单（树和内容）、加入书单、选书、图片查看器共 6 处改为显示原因 + Retry；回归测试 6 个（修复前失败）+ 浏览器验证（真的停掉后端） |
| BE-01 | P1 | Service 层 | 2 | ✅ | 与 BE-03 DTO 化合并；控制器不再直接用 Repository；open-in-view=false；2,695 个响应零差异 |
| BE-02 | P1 | 实体直出 / 列表接口过重 | 2 | ✅ | /api/books 请求/响应 DTO + chapterCount；列表 757 KB→25 KB；含 BUG-09 |
| BE-03 | P2 | API 风格统一 | 2 | ✅ | 201/204/404 约定 + 错误一律 ProblemDetail（doc/api-conventions.md）；前端无需改动，浏览器验证 |
| BE-04 | P1 | 全局异常处理 | 1 | ✅ | ProblemDetail + 前端解析 detail |
| BE-05 | P2 | 校验与枚举 | 2 | ✅ | 全部写接口 Bean Validation（长度/评分/状态值）+ Map 请求体换成 record；枚举映射因数据中有 '' 暂缓，已在 DB-06 完成 |
| BE-06 | P2 | 重复代码 | 2 | ✅ | 图片存储统一；两套导出共用 BookArchiveBuilder（随 BE-08）；JSON 导入与 ZIP 迁移共用 BookTreeWriter、前端两份导入循环删除（随 FE-08） |
| BE-07 | P2 | 导入整包入内存 | 4 | ✅ | 上传存为临时文件（用完即删），`ZipFile` 按需读取，图片流式写盘；zip bomb 防护改为"声明大小之和 ≤ 500 MB + 每个条目不超过声明大小"；图片在事务中写盘、回滚即删（SEC-04 移交），写盘失败时整本书失败；新测试 5 个（3 个修复前失败）；副本零差异，往返结果与改动前相同；`-Xmx160m` 导入 180 MB 归档：改动前 OOM，改动后成功 |
| BE-08 | P1 | 迁移归档不完整 | 2 | ✅ | 格式 v2（书评/书签/标记/书单路径 + 原始时间戳）、兼容 v1、拒绝更新版本；真实数据整库往返完全相同 |
| BE-09 | P3 | 配置分环境 | 4 | ✅ | 默认配置即安全配置（无 Console、无 CORS）+ dev profile（start-dev 启用，开 Console）+ prod profile；CORS 改为 `APP_CORS_ALLOWED_ORIGINS` 显式开启；devtools 并未打包（评审描述更正）；新测试 5 个（改动前失败）；副本零差异 |
| BE-10 | P2 | 升级 Spring Boot | 4 | ✅ | 3.2.5 → 3.5.16 → 4.1.2，两步各自提交。3.5：`@MockitoSpyBean`、删掉与基类冲突的异常处理、`ContentDisposition` 兜底参数的引号已转义（新断言修复前失败）。4.1：新 starter、Jackson 3（只固定"null 标志 = false"和字段顺序两个默认值）、关闭新增的探针和 LiveReload；特征测试 7 个（升级前通过）；副本：表和 schema 不变，2,741 个响应原始文本逐字相同，其余 8 个已解释（ProblemDetail 省略 `type`、增补平面字符不再转义）；往返不变，旧 jar 可回退；dev / prod 端到端、浏览器验证 |
| DB-01 | P0 | Schema 双源管理 | 0/2 | ✅ | V8 统一老库/空库结构 + 生产 `validate`；SchemaConvergenceTest（真实库结构夹具）；副本演练 2,724 响应零差异 |
| DB-02 | P1 | 外键与级联 | 2 | ✅ | V9：级联 + 图片 RESTRICT + 补外键 + 复合外键保证 book_id 一致；ForeignKeyConstraintsTest；副本演练零差异 |
| DB-03 | P3 | 删除 migrate.sql | 0 | ✅ | |
| DB-04 | P2 | 内联 base64 图片 | 4 | ⏸ | 盘点：真实数据中一张内联图片都没有；按方案 C 只给书评、讲解正文加 20 MB 上限（原来只有 Jackson 的 1 亿字符），超过时 400 并说明原因；图片外置（上传接口、归档 v3）等开始使用图片时再做；新测试 5 个（4 个改动前失败）；副本 `--strict` 零差异；浏览器验证 |
| DB-05 | P2 | 备份机制 | 0 | ✅ | 按需求缩小为手动 backup/restore 脚本，不做自动备份；陈旧锁自动识别（data-scripts.test.ps1） |
| DB-06 | P3 | 建模细节 | 4 | ✅ | `Chapter.explanation` 反向一对一已去掉（ChapterExplanationLoadingTest）；V10：书评/讲解的编辑时间 DATE→TIMESTAMP（接口返回日期时间，界面仍显示日期，归档保持 v2 并兼容纯日期）、`readingStatus` `''`→NULL + 枚举 + CHECK（请求仍接受 `""`）、`structureType` 枚举 + CHECK；分类不拆表（理由见条目）；新测试后端 9 个、前端 5 个（改动前失败）；副本 116 个差异全部属于这两类，表内容不变，往返不变，旧归档导入结果与迁移结果相同；浏览器验证 |
| FE-01 | P1 | 拆分超大组件/样式 | 3 | ✅ | 3 个组件拆成 hook + 子组件（1049→483、1029→144、531→175 行），index.css 按原顺序切成 22 个文件；特征测试先行（前端 52→119）；构建 CSS 逐字节相同；5 主题 × 18 场景新旧版本 DOM 与截图逐像素相同 |
| FE-02 | P1 | ESLint 清零 | 1 | ✅ | 0 error / 0 warning，CI 阻断；9 处加载 effect 的 disable 已随 FE-03 删除 |
| FE-03 | P1 | 数据获取 N+1 / 缓存 | 3 | ✅ | 聚合接口 `GET /books/{id}/detail`（语句数固定）+ TanStack Query（共享缓存、写后全部失效、请求取消）；详情页 70+ 请求 → 1；9 处 eslint-disable 已删除 |
| FE-04 | P2 | 代码分割 | 3 | ✅ | 6 个页面 + 编辑器 + 导出/迁移弹窗懒加载；首屏 JS 1,249→311 KB（gzip 380→97），CSS 不变；旧 chunk 失效时自动刷新一次；TipTap 改为挂载后创建（懒加载后会被提前销毁）；开发模式新旧对比 122 屏相同 |
| FE-05 | P2 | 错误处理与反馈 | 3 | ✅ | 自写 Toast（失败说明原因，表单/确认框保留输入可重试）+ 页面级/根级 ErrorBoundary（chunk 失败提示刷新，自动刷新时不闪错误界面）+ 404（未知地址、非数字 id、不存在的书）+ 统一 ConfirmDialog（去掉 alert/confirm，讲解和图片删除加确认）；正常界面 5 主题 × 18 场景新旧完全相同 |
| FE-06 | P1 | jszip 依赖归位 | 0 | ✅ | |
| FE-07 | P3 | api.js 样板 / 类型 | 4 | ⬜ | |
| FE-08 | P2 | JSON 导入移到后端 | 3 | ✅ | 3 个单事务导入接口（与 ZIP 迁移共用 BookTreeWriter）+ 前端 6 种导入各一个请求（utils/jsonImport.js）；真实数据 24 本 JSON 往返完全相同 |
| SEC-01 | P1 | 富文本 XSS 清洗 | 3 | ✅ | DOMPurify：粘贴入口 + 显示出口 + 导出；真实数据零差异 |
| SEC-02 | P2 | 图片类型白名单 | 4 | ✅ | PNG/JPEG/GIF/WebP 按文件头判断（上传、下载都是）；其他文件跳过，旧行作为附件下载；nosniff + sandbox CSP；`ContentDisposition`（ASCII 输出不变）；ImageTypeSafetyTest 14 个（修复前 9 个失败）；副本零差异；浏览器验证 |
| SEC-03 | P1 | 仅监听本机 / 关 H2 Console | 4 | ✅ | `server.address=127.0.0.1` + Vite 去掉 `--host`；prod profile 关 Console（dev 保留，仅本机）；补充：去掉 H2 `AUTO_SERVER`（数据库曾对局域网开端口；顺带不再留陈旧锁）；NetworkExposureTest 3 个（修复前失败）；副本 2,748 响应零差异；本机局域网 IP 连不上 |
| SEC-04 | P3 | 导入边界校验 | 4 | ✅ | 归档图片按文件内容判断（复用 SEC-02），扩展名/类型由检测结果决定；跳过的图片（非图片、缺文件）写进导入报告并在前端显示；超长文件名截断；提交后写盘的问题移交 BE-07；回归测试修复前失败；副本零差异，往返结果与改动前相同；浏览器验证 |
| SEC-05 | P2 | 依赖漏洞扫描 | 4 | ✅ | 依赖已升级（prod audit 0）；Dependabot 已配置，推送后生效 |
| ENG-01 | P0 | 测试 | 1 | 🔄 | 后端 233 个（含 N+1 回归、迁移往返、OSIV 关闭、新旧库结构一致、数据库外键与 CHECK 约束、输入校验（含富文本大小上限）、API 状态码约定、详情聚合接口、JSON 导入、仅本机监听、配置分环境与 CORS、图片类型、上传报告、导入图片校验、导入写盘与 zip bomb 防护、健康检查与 SPA 回退、JSON 绑定、阅读状态与编辑时间）+ 前端 Vitest 189 个（含 RTL 组件测试、fetch 层假后端、FE-01 的特征测试、FE-05 的失败场景）；每个修复附回归测试 |
| ENG-02 | P1 | CI | 1 | ✅ | GitHub Actions；lint 已阻断（FE-02）；推送后确认首次运行 |
| ENG-03 | P1 | 仓库卫生 | 0 | ✅ | node_modules 清理完成；提交信息规范持续执行 |
| ENG-04 | P2 | 构建可复现 | 4 | ✅ | Maven Wrapper（3.9.16 + SHA-256 校验）；enforcer 要求 Java 17+ / Maven 3.6.3+；`engines.node` + `.nvmrc`（CI 读取）+ `engine-strict`；`tools/java-env.ps1`：三个脚本都支持 `.java-home` 并预先检查 Java 版本；用 JRE 11 / Node 20 实测提示；start-dev / start-prod / build-prod 端到端验证 |
| ENG-05 | P2 | 文档更新 | 4 | 🔄 | 每阶段顺带更新相关文档；新增 development-workflow.md（工作约定 + 真实数据副本验证工具 tools/rehearsal） |
| ENG-06 | P3 | 脚本小问题 | 4 | ✅ | 强杀留下的陈旧锁不再阻止备份/恢复；start 脚本记录 PID + 启动时间，stop 脚本停止整个进程树（不再按端口误杀或漏杀）；`/actuator/health`（只暴露 health、不含细节，SPA 回退排除 actuator）作为就绪判断；端口函数合并到 `tools/app-run.ps1`；`npx.cmd` / `npm.cmd`（直接运行 `.\start-dev.ps1` 时前端起不来）+ 显示 job 错误；新测试：后端 12 个（4 个修复前失败）+ 脚本 17 个场景；dev / prod 端到端验证；副本只多了 health 一项 |
