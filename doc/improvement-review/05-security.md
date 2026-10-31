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

[ChapterImageController](../../backend/src/main/java/com/bookscoreideas/controller/ChapterImageController.java)：
- 仅检查客户端声明的 `Content-Type` 以 `image/` 开头，扩展名直接取自原始文件名 → 可上传 `image/svg+xml`（可含脚本）。下载时按存储的 Content-Type `inline` 返回，在 prod 单端口模式下与应用**同源**，直接打开该图片 URL 即可执行脚本。迁移导入会原样保留归档里的 `contentType`。
- 第 102 行 `"inline; filename=\"" + image.getOriginalName() + "\""` 直接拼接用户可控文件名（含引号/非 ASCII 时头部错误）。

**建议**：白名单（png/jpeg/gif/webp），用文件头魔数校验真实类型；扩展名由检测到的类型决定；响应加 `X-Content-Type-Options: nosniff`；用 Spring 的 `ContentDisposition.inline().filename(name, UTF_8).build()`。

---

<a id="sec-03"></a>
## SEC-03 · 服务暴露范围与 H2 Console 🟠

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
