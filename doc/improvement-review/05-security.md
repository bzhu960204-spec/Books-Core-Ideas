# 05 · 安全

> **威胁模型**：单用户、本地运行、无登录。因此"多用户越权"不是重点；真正的风险来源是
> ① 应用被同一网络中的其他人访问（例如公司内网）；② **导入他人提供的内容**（迁移 ZIP、粘贴的 AI 回答 HTML）；③ 依赖漏洞。

| ID | 优先级 | 主题 |
|---|---|---|
| SEC-01 | 🟠 P1 | 富文本 HTML 未清洗即 `dangerouslySetInnerHTML` |
| SEC-02 | 🟡 P2 | 图片上传信任客户端 Content-Type；响应头拼接文件名 |
| SEC-03 | 🟠 P1 | 服务监听所有网卡、无认证；H2 Console 常开 |
| SEC-04 | ⚪ P3 | 迁移导入的边界校验 |
| SEC-05 | 🟡 P2 | 无依赖漏洞扫描 |

---

<a id="sec-01"></a>
## SEC-01 · 富文本 HTML 未清洗 🟠

> **✅ 已修复（2026-10-31）**，粘贴 AI 回答的用法不变：
> - 新增 [sanitizeHtml.js](../../frontend/src/utils/sanitizeHtml.js)（DOMPurify 默认规则 + 保留链接 `target`，并强制 `rel="noopener noreferrer"`）。
> - **入口**：编辑器四条粘贴路径（原生粘贴 `transformPastedHTML`、`takeOver`、Markdown 转换、Copilot 代码块）均先清洗剪贴板 HTML。
> - **出口**：`normalizeReviewContent` 返回清洗后的 HTML，覆盖讲解阅读、书评阅读、书评库、编辑器加载；讲解导出（HTML/PDF）单独清洗；讲解阅读窗口用 `useMemo` 缓存清洗结果。
> - 真实数据验证：对备份库中 **51 篇讲解 + 3 篇书评（约 263 万字符）**，清洗前后 HTML 与纯文本均**零差异**（已保存段落的定位偏移不受影响）。
> - 浏览器验证：数据库中存入含 `<img onerror>`、`javascript:` 链接、`<script>` 的讲解，阅读模式下均未执行、正常链接保留；5 类粘贴结果与清洗前逐字一致，Copilot "Render code blocks" 仍可用。
> - 测试：[sanitizeHtml.test.js](../../frontend/src/utils/sanitizeHtml.test.js)（6 个；去掉清洗后 4 个安全用例失败）。后端保存时清洗暂未做。

**现状**：
- [ChapterExplanationModal.jsx](../../frontend/src/components/ChapterExplanationModal.jsx) 第 25 行、[ReviewReaderModal.jsx](../../frontend/src/components/ReviewReaderModal.jsx) 第 90 行用 `dangerouslySetInnerHTML` 渲染数据库中的 HTML；
- [ExplanationExportModal.jsx](../../frontend/src/components/ExplanationExportModal.jsx) 通过 `innerHTML` 生成导出文档；
- 项目中**没有任何 HTML 清洗**（未引入 DOMPurify 等）。后端保存 explanation/review 时也不做清洗。

**攻击路径**：导入别人分享的迁移 ZIP（explanation 内容原样入库）或粘贴来源不可信的 HTML → 打开讲解时 `<img onerror=...>` 等脚本执行 → 可调用本地 API 删除/篡改全部数据。

**建议**：引入 `dompurify`，在**渲染前**统一 `DOMPurify.sanitize(html)`（保留 TipTap 产生的标签/样式白名单）；可选在后端保存时再做一次（如 OWASP Java HTML Sanitizer）。

---

<a id="sec-02"></a>
## SEC-02 · 图片上传与下载 🟡

> **✅ 已修复（2026-11-01）**：上传和下载都只认文件内容，不再相信客户端声明的类型或文件名。
>
> **设计决定**（简单项，按最佳判断）
> 1. **白名单**：PNG / JPEG / GIF / WebP，即上传界面原本就写着的 "Supports JPG, PNG, GIF, WebP"。不包括 SVG（可以带脚本）。
> 2. **按文件头判断类型**：新增 [ImageType](../../backend/src/main/java/com/bookscoreideas/service/ImageType.java)。
>    - 客户端的 Content-Type 和扩展名一律不用。保存的扩展名和 `contentType` 都由检测结果决定，所以 `photo.png` 里实际是 JPEG 时，会保存为 `.jpg` / `image/jpeg`。
>    - `originalName` 仍按原样保存，只用于显示。
>    - 不是这四种图片的文件，和以前一样**跳过**；返回失败列表属于紧接着的 [BUG-10](01-verified-bugs.md#bug-10)。
> 3. **下载时从磁盘上的文件重新判断类型**，不使用库里存的 `contentType`。这样也能覆盖 SEC-02 之前上传的行，以及迁移导入的行（导入时的校验在 [SEC-04](#sec-04)）。
>    - 能识别的图片：`inline` + 真实类型；
>    - 其他文件：`application/octet-stream` + `attachment`，只能下载，浏览器不会渲染。
> 4. **图片响应一律带上**：
>    - `X-Content-Type-Options: nosniff`；
>    - `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`。即使图片被当成页面直接打开，也不能执行脚本。放行内联样式是为了保留浏览器自带看图页的样式（居中、深色背景），内联样式本身无法执行脚本。
> 5. **`Content-Disposition`** 改用 Spring 的 `ContentDisposition` 生成：
>    - ASCII 文件名的输出与以前完全相同（`inline; filename="page.png"`）；
>    - 非 ASCII 文件名由 Spring 生成 `filename*=UTF-8''…`（RFC 5987），另加一个 RFC 2047 格式的 `filename="=?UTF-8?Q?…?="` 作为兜底。注意：Spring 6.1 不会转义兜底参数中的引号。浏览器优先使用 `filename*`，所以不影响结果；BE-10 升级后再看一次；
>    - 引号、反斜杠会被转义；控制字符（包括换行）会被去掉，防止注入响应头。
> 6. **前端**：上传控件的 `accept` 从 `image/*` 改为这四种类型。服务端才是真正的限制，这一项只是让选择文件时少一些误选。
>
> **测试** [ImageTypeSafetyTest](../../backend/src/test/java/com/bookscoreideas/books/ImageTypeSafetyTest.java)，共 14 个：
> - 四种格式按真实类型保存和返回，包括"声明为 octet-stream、没有扩展名"和"扩展名与内容不符"两种情况；
> - SVG、伪装成 PNG 的 HTML 被跳过；
> - 响应头 nosniff / CSP；
> - 旧行（直接写入库和磁盘）声称是 `image/svg+xml` 时，作为附件、以 octet-stream 返回；
> - 文件名中的中文与引号、反斜杠与分号、CRLF 都能还原，且响应头中没有换行。
>
> 修复前 9 个失败，其余 5 个是修复前后都应通过的行为（例如正常 PNG、`text/html` 被跳过）。现有的 `ImageApiTest`（包括逐字比较 `Content-Disposition`）不用修改，照常通过。后端共 187 个测试通过。
>
> **验证**
> - 真实数据副本：改动前后 2,748 个 GET 响应零差异，各表不变。真实库只有 5 张 PNG，而且文件不在本机，所以改动前后都是 404。
> - 浏览器（副本 + Vite）：在上传控件中同时选择一张真实 PNG 和一个带 `<script>` 的 SVG。只保存了 PNG，正常显示（240×120），响应头符合预期。在新标签页直接打开图片地址时也正常显示；VS Code 浏览器注入的脚本被 `sandbox` 拦下。
[ChapterImageController](../../backend/src/main/java/com/bookscoreideas/controller/ChapterImageController.java)：
- 仅检查客户端声明的 `Content-Type` 以 `image/` 开头，扩展名直接取自原始文件名 → 可上传 `image/svg+xml`（可含脚本）。下载时按存储的 Content-Type `inline` 返回，在 prod 单端口模式下与应用**同源**，直接打开该图片 URL 即可执行脚本。迁移导入会原样保留归档里的 `contentType`。
- 第 102 行 `"inline; filename=\"" + image.getOriginalName() + "\""` 直接拼接用户可控文件名（含引号/非 ASCII 时头部错误）。

**建议**：白名单（png/jpeg/gif/webp），用文件头魔数校验真实类型；扩展名由检测到的类型决定；响应加 `X-Content-Type-Options: nosniff`；用 Spring 的 `ContentDisposition.inline().filename(name, UTF_8).build()`。

---

<a id="sec-03"></a>
## SEC-03 · 服务暴露范围与 H2 Console 🟠

> **✅ 已修复（2026-11-01）**：应用只接受本机连接，prod 不再有 H2 Console。
>
> **设计决定**
> 1. **不提供局域网开关**（用户确认不需要从手机/局域网访问）。因此也不需要口令认证；以后确有需要，再加显式开关并配合认证。
> 2. **`server.address=127.0.0.1`**，写在 `application.properties` 中，dev 和 prod 都生效。用 IP 而不是 `localhost`：`localhost` 可能只解析成 `::1`，而浏览器打开 `http://localhost:<端口>` 时会自动退回 IPv4，用户的使用方式不变。
> 3. **dev 保留 H2 Console**（由我判断）：它已经只能从本机访问，开发时查数据有用。新增 [application-prod.properties](../../backend/src/main/resources/application-prod.properties) 关闭它，[start-prod.ps1](../../start-prod.ps1) 用 `--spring.profiles.active=prod` 启动，并不再打印 Console 地址。这个 prod profile 也是 [BE-09](02-backend-architecture.md#be-09) 的起点。
> 4. **Vite 去掉 `--host 0.0.0.0`**：默认只监听本机。代理目标（[vite.config.js](../../frontend/vite.config.js) 的默认值、`start-dev.ps1` 设置的 `VITE_API_PROXY_TARGET`）改为 `http://127.0.0.1:<端口>`。
> 5. **本机工具也改用 `127.0.0.1`**：第一次在副本上验证时，[rehearse.ps1](../../tools/rehearsal/rehearse.ps1) 用 `http://localhost:<端口>` 采集，Python 先尝试 `::1`。在 Windows 上，每次被拒绝的连接要等约 2 秒才退回 IPv4，2,748 个请求因此要一个半小时。Vite 代理也有同样的问题，所以 4 中改为 IP。
>
> **测试** [NetworkExposureTest](../../backend/src/test/java/com/bookscoreideas/web/NetworkExposureTest.java)（2 个）：在真实端口上按 dev / prod 两种配置启动应用（内存库），断言回环地址能连上、本机各网卡的 IPv4 地址都连不上，并且 `/h2-console/` 在 dev 为 200、在 prod 为 404。
> - 修复前两个测试都失败：从网卡地址能连上。只加 `server.address` 后，prod 仍失败：Console 返回 200。
>
> **验证**
> - 后端 167 个测试通过；前端 lint 0 / 181 个测试通过。
> - 真实数据副本：改动前后 2,748 个 GET 响应零差异，12 张表不变。
> - 手动：prod 方式（prod profile + 前端 dist）和 dev 方式（无 profile 的后端 + 不带 `--host` 的 Vite）都在副本上运行。用本机局域网 IP（10.0.0.31）连接 18083、18084、15173 均被拒绝；prod 的 `/h2-console/` 为 404，dev 为 200；浏览器通过 `http://localhost:…` 打开书籍详情页正常。
>
> **补充（2026-11-01，BE-09 开工时发现）：数据库自己也在监听局域网**
> - **问题**：真实库的连接串带 `AUTO_SERVER=TRUE`。H2 因此在**所有网卡**上开一个随机 TCP 端口，供其他进程共用这个库，并在 `booksdb.lock.db` 中写下 `server=10.0.0.31:<端口>`。外部要连接，还需要锁文件中的随机 id，加上 `sa` / 空密码。风险不高，但违背"只接受本机连接"。前面的验证都覆盖了连接串，所以没有发现。
> - **决定**（用户确认）：去掉 `AUTO_SERVER`，不改成"只绑定 127.0.0.1"。仓库中没有任何地方依赖它。它唯一的用处是让两个进程（例如同时运行的 dev 和 prod）共用一个库；现在第二个进程会报 "Database may be already in use" 并拒绝启动，这对数据更安全。
> - **顺带解决的问题**：只有 `AUTO_SERVER` 会让 H2 使用 `booksdb.lock.db` 锁文件。去掉后，H2 直接锁住 `.mv.db`，进程退出（包括被强杀）时由操作系统释放。所以 `stop-dev.ps1` 强杀后**不再留下陈旧锁**（[DB-05 补充](03-database-and-data-safety.md#db-05)、[ENG-06](06-engineering-practices.md#eng-06)）。备份/恢复脚本判断"正在使用"的依据是 `.mv.db` 能否独占打开，所以不受影响。真实库目录中现有的旧锁文件会继续被识别为陈旧锁，应用停止时可以删掉。
> - **测试**：`NetworkExposureTest.theDatabaseOpensNoNetworkPort`（第 3 个）读取 `application.properties` 中真实的连接串，只把路径换成临时目录，打开数据库后断言 H2 没有登记 TCP 服务。修复前失败（`server` 为 `10.0.0.31:…`）；临时恢复 `AUTO_SERVER` 后再次失败，去掉后通过。后端 168 个测试通过。
> - **验证**：在临时目录中放一份最新备份的副本，jar **不覆盖连接串**启动，也就是使用真实的默认连接串。V8/V9 迁移成功；进程只监听 `127.0.0.1:18083`；没有生成锁文件，备份脚本判断为 `in-use`；第二个实例报 "already in use" 并退出；强杀后判断为 `free`。GET 响应不受影响：对比工具本来就覆盖连接串，所以没有重跑对比。

**现状**：
- Spring Boot 默认监听 `0.0.0.0`，`application.properties` 未设置 `server.address`；`start-dev.ps1` 用 `vite --host 0.0.0.0` 启动前端。
- 所有 API 无认证。CORS 只约束浏览器跨域，**不能**阻止同网段任何人直接 `curl http://<你的IP>:8080/api/books`，或在 prod 模式下直接用浏览器打开 `http://<你的IP>:8080` 使用整个应用（包括删除数据）。
- `spring.h2.console.enabled=true` 在 prod 模式同样开启（`start-prod.ps1` 还会打印其地址）。Spring Boot 默认 `web-allow-others=false`，因此仅本机可访问，风险较低，但 prod 无需此功能。

**建议**：
- 默认 `server.address=127.0.0.1`；Vite 去掉 `--host 0.0.0.0`（确需手机/局域网访问时显式开关，并配合简单的口令认证）。
- prod profile 关闭 H2 Console（`spring.h2.console.enabled=false`），dev 保留。

---

<a id="sec-04"></a>
## SEC-04 · 迁移导入的边界校验 ⚪

> **✅ 已修复（2026-11-01）**：迁移归档中的图片和上传一样，按文件内容判断（SEC-02）。没有导入的图片会在导入报告中逐一列出。
>
> **设计决定**（简单项，按最佳判断）
> 1. **按文件内容判断**：[BookTreeWriter](../../backend/src/main/java/com/bookscoreideas/service/BookTreeWriter.java) 用 `ImageType.detect` 判断归档里每张图片的实际类型。
>    - 新文件名的扩展名和 `contentType` 都由检测结果决定。归档中的 `filename` 只用来在 ZIP 里找到对应的文件，`contentType` 一律不用。
>    - 这比评审建议的"扩展名只允许 `[a-z0-9]{1,5}`"更严格，原来的 `extensionOf` 已删除。
>    - 不是这四种图片的文件不入库、不写盘。下载时本来也会按文件内容判断（SEC-02），这里是在入口再拦一次。
> 2. **报告没有导入的图片**：书仍是 `IMPORTED`，`message` 写成 "Skipped 2 images: logo.svg (not a PNG, JPEG, GIF or WebP image); gone.png (missing from the archive)"。
>    - 归档中缺少文件的图片，原来静默跳过，现在也一并报告。
>    - 跳过的原因与 BUG-10 统一：`SkippedFile` 提为独立的 DTO，新增原因 `missing from the archive`。
>    - 前端 [BookMigrationModal](../../frontend/src/components/BookMigrationModal.jsx) 在导入结果中，把这条信息显示在书名下方。
> 3. **`originalName` 超长时截断**：放到 `ChapterImage.fitOriginalName` 中，上传和导入共用。原来整本书会导入失败。
> 4. **交给 BE-07**：图片文件在事务**提交后**才写盘。写盘失败时，这本书会被报告为 FAILED，但数据库里已经有了。这正是 BE-07 要改的代码（不再整包读入内存，改为按需读取、流式写盘），所以一起处理。
>    - **已随 [BE-07](02-backend-architecture.md#be-07) 完成**：图片在事务中写盘，回滚即删除；写盘失败时整本书回滚并报告 FAILED。
>
> **测试** [MigrationImageSafetyTest](../../backend/src/test/java/com/bookscoreideas/migration/MigrationImageSafetyTest.java)：手工构造一个归档，包含以下 5 张图片：
> - 声明为 `image/svg+xml` 的真实 PNG；
> - 声明为 `image/png` 的带脚本 SVG；
> - 文件名为 `scan./evil`（按旧逻辑，扩展名会是 `./evil`）；
> - 归档中缺少文件的图片；
> - 300 字符的文件名。
>
> 断言：3 张以 `<uuid>.png` / `image/png` 导入，原始字节可以下载，另外 2 张在报告中写明原因。修复前整本书导入失败（`FAILED`）。另有一个特征测试（没有跳过的图片时 `message` 为 null），修复前后都通过。前端新增 1 个，修复前失败。后端共 195 个、前端共 184 个测试通过。
>
> **验证**
> - 真实数据副本：改动前后 2,748 个 GET 响应零差异，各表不变。
> - 往返（`roundtrip.py`，真实数据副本 → 空库）：改动前后结果相同，ZIP 导入 24 本全部成功，JSON 导入 24 本往返完全相同。ZIP 只有 book 195 的 `book.json` 不同，原因与 [BE-08](02-backend-architecture.md#be-08) 记录的一样：这 5 张图片的文件不在本机。现在导入报告会写明 "Skipped 5 images: … (missing from the archive)"，原来不会提示。
> - 浏览器：通过迁移弹窗导入一个构造的"他人分享"归档，结果为 "✓ 1 ch · 1 img"，书名下方显示被跳过的 `logo.svg` 和 `gone.png` 及原因。导入的那张图片以 `.png` / `image/png` 保存，能正常解码（240×120）。

[MigrationService](../../backend/src/main/java/com/bookscoreideas/service/MigrationService.java) 已有不错的防护（条目数上限、解压总量上限、写盘前 `normalize + startsWith` 路径穿越校验）。剩余小问题：
- 新文件名扩展名取自归档内文件名（`MigrationImporter.extensionOf`），可能包含 `/`、`..` 等字符；虽然写盘时会被路径校验拦截，但数据库里已经插入了指向无效文件的 `ChapterImage` 行。建议扩展名只允许 `[a-z0-9]{1,5}` 白名单。
- 归档中的 `contentType` 应按 SEC-02 的白名单重新判定。

---

<a id="sec-05"></a>
## SEC-05 · 无依赖漏洞扫描 🟡

> **实测（2026-10-31）**：`npm audit --omit=dev` 报告 **37 个漏洞（3 high / 33 moderate / 1 low）**，其中包括 `prosemirror-view <1.42.3` 的**粘贴处理 XSS**（GHSA-c8x8-7fp4-3x9w）——TipTap 编辑器依赖它，而本项目大量粘贴外部 AI 回答，与 SEC-01 叠加风险较高。建议优先升级 TipTap / ProseMirror 相关依赖。
>
> **✅ 依赖已升级（2026-10-31）**：全部 `@tiptap/*` 3.26.1 → 3.32.2（同时修复 `@tiptap/core ≤3.30.4` 的 `mergeAttributes` `__proto__` 高危），`prosemirror-view` 1.41.9 → 1.42.9，`react-router` 7.15.0 → 7.18.5。`npm audit --omit=dev` → **0 个漏洞**。
> 验证：只有一份 `@tiptap/core`、36 个 TipTap 包版本一致；lint 不变、构建通过；在浏览器中对升级前（worktree）与升级后用同一脚本粘贴 Markdown / 富文本 / 颜色链接 / Copilot / 恶意 HTML 五类内容并逐字对比——唯一差异是表格单元格不再输出默认的 `colspan="1" rowspan="1"`（项目中无依赖），恶意 HTML 在两版中均未执行。
> 剩余：开启 Dependabot（待推送到 GitHub 后在仓库设置中启用或提交 `.github/dependabot.yml`）。
>
> **✅ Dependabot 已配置**：[.github/dependabot.yml](../../.github/dependabot.yml)——npm（`/frontend`，每周；`@tiptap/*`、`prosemirror-*` 各自分组为一个 PR，保证 TipTap 版本一致）、maven（`/backend`，每周）、github-actions（每月）。已通过 SchemaStore 官方 schema 校验。推送到 GitHub 后生效。

没有 Dependabot / `npm audit` / OWASP Dependency-Check。结合 [BE-10](02-backend-architecture.md#be-10)（Spring Boot 3.2.x 已停止 OSS 支持），建议在 GitHub 开启 Dependabot（maven + npm），并在 CI 中运行 `npm audit --omit=dev`。
