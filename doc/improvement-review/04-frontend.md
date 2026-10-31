# 04 · 前端

> 范围：`frontend/src/**`（React 19 + Vite 8 + TipTap 3 + React Router 7）。
> 客观信号：`npm run lint` → **31 errors / 3 warnings**；`npm run build` → 单个 JS chunk **1,192 KB（gzip 359 KB）**。

| ID | 优先级 | 主题 |
|---|---|---|
| FE-01 | 🟠 P1 | 超大组件与超大样式文件 |
| FE-02 | 🟠 P1 | ESLint 不通过 |
| FE-03 | 🟠 P1 | 数据获取：N+1 请求、无缓存、重复拉全库 |
| FE-04 | 🟡 P2 | 包体积：无代码分割 |
| FE-05 | 🟡 P2 | 错误处理与交互反馈不一致 |
| FE-06 | 🟠 P1 | 依赖声明错误：`jszip` 不在前端 package.json |
| FE-07 | ⚪ P3 | `api.js` 样板代码；缺类型约束 |
| FE-08 | 🟡 P2 | JSON 导入在前端逐条请求、非事务 |

---

<a id="fe-01"></a>
## FE-01 · 超大组件与超大样式文件 🟠

| 文件 | 行数 | 说明 |
|---|---|---|
| [BookDetailPage.jsx](../../frontend/src/pages/BookDetailPage.jsx) | 1259 | **36 个 `useState`**、68 处 API 调用；集加载、章节/Part/想法/摘录 CRUD、3 种 JSON 导入、图片、讲解、书签、标记于一身 |
| [RichTextEditor.jsx](../../frontend/src/components/RichTextEditor.jsx) | 1064 | 编辑器 + 粘贴转换 + Copilot 代码块修复 + 链接修复 + 图片处理 + 工具栏 |
| [ChapterExplanationModal.jsx](../../frontend/src/components/ChapterExplanationModal.jsx) | 521 | 12 个 `useEffect` |
| [index.css](../../frontend/src/index.css) | **3860** | 全局单文件，所有组件样式 + 主题 |

**后果**：改一处牵动全身、难以测试、合并冲突多、渲染粒度粗（任一状态变化重渲染整页）。

**建议拆分方向**：
- `BookDetailPage` → `useBookDetail(id)`（加载与缓存）、`useChapterMutations`、`<ChapterList>`、`<ChapterCard>`、`<BookHeader>`、`<BookImportPanel>`；导入解析逻辑抽到 `utils/jsonImport.js`（与 LibraryPage 共用，顺带修 BUG-06）。
- `RichTextEditor` → `editor/extensions/*`、`editor/paste/*`（纯函数，可单测）、`<EditorToolbar>`。
- `index.css` → 按组件拆成 `*.module.css` 或同名 css 文件；主题变量保留在 `theme.css`。

---

<a id="fe-02"></a>
## FE-02 · ESLint 不通过 🟠

| 规则 | 数量（约） | 说明 |
|---|---|---|
| `react-hooks/set-state-in-effect` | 18 | effect 内同步 setState，多数是"挂载即加载"模式 |
| `react-refresh/only-export-components` | 5 | 组件文件同时导出常量/函数（如 `ThemeContext.jsx`），破坏 HMR |
| `react-hooks/refs` "Cannot access refs during render" | 4 | `RichTextEditor` 中 `xxxRef.current = state` 写在 render 里 |
| `no-unused-vars` / `no-useless-escape` / `no-control-regex` | 4 | 小问题（BUG-11 修复时去掉了 `markdownToHtml` 的 `\u0000` 占位符，当前共 **30 errors**） |
| 警告（`exhaustive-deps` ×2、无用的 eslint-disable ×1） | 3 | `BookDetailPage` `loadBook`、`ChapterImageViewer` `idx` |

**建议**：先修真实问题（refs、deps、unused），"挂载加载"类在 FE-03 引入数据层后自然消失；然后把 `npm run lint` 纳入 CI（ENG-02），保持 0 error。

---

<a id="fe-03"></a>
## FE-03 · 数据获取：N+1、无缓存、重复拉全库 🟠

- **详情页扇出**：[BookDetailPage.loadBook](../../frontend/src/pages/BookDetailPage.jsx) 先取章节列表，再对**每个章节**各请求一次 excerpts、一次 images（第 224–246 行）。50 章的书 = 100+ 个请求。
- **重复拉全库**：书库、想法库、摘录库、书评库、阅读历史 5 个页面都调用 `bookApi.getAll()`，而该接口返回每本书完整的章节+想法树（BE-02）。其它页面只是为了渲染"按书筛选"下拉框。
- **"全部替换"导入**：先逐条 `DELETE` 再逐条 `POST`（第 623–683、1119–1129 行），中途失败会留下半成品。
- 每个页面自管 `loading/error`，切换页面全部重拉，无缓存、无请求取消（快速切书可能出现旧响应覆盖新数据的竞态）。

**建议**：
1. 后端提供聚合接口：`GET /api/books/{id}/detail`（一次返回章节+想法+摘录计数/列表+图片数+讲解标记）、`GET /api/books?fields=summary`（轻量列表）、`PUT .../ideas:replace`（事务内替换）。
2. 前端引入 **TanStack Query**（或至少一个小的 `useApi` hook + 缓存 + AbortController），统一 loading/error/重试/失效。

---

<a id="fe-04"></a>
## FE-04 · 包体积：无代码分割 🟡

单 chunk 1.19MB。TipTap（含 ProseMirror）、`marked`、`react-markdown`、`jszip` 都打进了首屏，即使只打开书库列表。

**建议**：
- 路由级 `React.lazy`：除 `LibraryPage` 外的页面懒加载；
- `RichTextEditor`、`ExplanationExportModal`（jszip）、`BookMigrationModal` 按需 `import()`；
- 目标：首屏 chunk < 300KB。

---

<a id="fe-05"></a>
## FE-05 · 错误处理与交互反馈不一致 🟡

- 6 处 `.catch(() => {})` 静默吞错（如各页面加载书列表）；多处 `catch { console.error(...) }` 用户无感知。
- 确认/提示混用：自有 `ConfirmDialog` 与 `window.confirm` / `window.alert`（`CollectionsExplorer`、`PickBooksModal`、`ExplanationExportModal`、`RichTextEditor`）。
- 没有 React Error Boundary：任一组件抛错整页白屏。
- 没有 404 路由（`/book/abc` 或未知路径）。

**建议**：一个轻量 Toast 组件 + 全局 `ErrorBoundary` + `<Route path="*">`；`apiFetch` 解析后端 `ProblemDetail`（BE-04）输出人类可读的错误；统一用 `ConfirmDialog`。

---

<a id="fe-06"></a>
## FE-06 · 依赖声明错误：`jszip` 🟠

> **✅ 已修复（2026-10-31）**：`jszip@^3.10.2` 已加入 `frontend/package.json`；根目录 `package.json`、`package-lock.json`、`node_modules/` 已删除；删除根目录 `node_modules` 后 `npm run build` 仍成功，说明依赖已在前端内部解析。

[ExplanationExportModal.jsx](../../frontend/src/components/ExplanationExportModal.jsx) `import JSZip from 'jszip'`，但 `jszip` 只声明在**仓库根目录**的 [package.json](../../package.json)，不在 [frontend/package.json](../../frontend/package.json)。目前能构建，仅因为 Node 模块解析会向上找到根目录 `node_modules`。
同时根目录 `node_modules/`（163 个文件）被提交进了 git（见 ENG-03）。

**后果**：单独 clone 并在 `frontend/` 下 `npm ci` 的环境（如 CI）构建会失败；依赖版本不受前端 lock 文件控制。

**建议**：`cd frontend && npm i jszip`；删除根目录 `package.json`、`package-lock.json`、`node_modules/`。

---

<a id="fe-07"></a>
## FE-07 · `api.js` 样板代码；缺类型约束 ⚪

[api.js](../../frontend/src/api.js) 中 `method/headers/body: JSON.stringify` 重复约 30 次；`migrationApi.exportBooks` 绕开 `apiFetch` 自己处理错误。

**建议**：`const json = (method, body) => ({ method, headers: {...}, body: JSON.stringify(body) })` 之类的小工具；中长期可考虑 TypeScript（或至少 JSDoc 类型 + `// @ts-check`），从后端 DTO 生成类型更佳（如 springdoc-openapi → openapi-typescript）。

---

<a id="fe-08"></a>
## FE-08 · JSON 导入在前端逐条请求、非事务 🟡

书库与详情页的 JSON 导入都由前端循环调用 `create` 接口完成：一本 30 章、每章 10 个想法的书需要 300+ 次串行请求；中途任一失败会留下"半本书"，且没有回滚。两处实现不一致（BUG-06）。

**建议**：后端 `POST /api/books/import-json`（与 `MigrationImporter` 复用持久化逻辑，单事务），前端只做 JSON 解析与预览。
