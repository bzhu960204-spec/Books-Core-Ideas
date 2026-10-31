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

> **✅ 已完成（2026-10-31）**：`npm run lint` 由 30 errors / 3 warnings 降为 **0 / 0**；脚本改为 `eslint . --max-warnings 0`，CI 中 lint 改为阻断（警告同样会导致失败）。分 4 个提交：
> 1. `a78b9ef` 非组件导出拆到单独文件：`utils/reviewContent.js`（`normalizeReviewContent`）、`collections/folderTree.js`、`useTheme.js` + `themes.js`；同时去掉多余转义、多余的 disable，并开启 `ignoreRestSiblings`（用剩余解构剔除字段的写法）。
> 2. `249dcfd` `RichTextEditor` 不再在 render 期间读写 ref：镜像 ref 改在 `useLayoutEffect` 中同步，初始 HTML 改为惰性 state（顺带避免每次渲染都重新清洗内容）。引入 `@testing-library/react`，新增 `RichTextEditor.test.jsx`；去掉 ref 同步后，"粘贴模式切换"用例会失败。
> 3. `2a4b867` 只是"把 props 复制进 state"的 effect：5 个表单改为惰性初始化，调用处加 `key={id}`；讲解、书评 Modal 以及两处菜单改为"记住上一次的 prop，在渲染时比较并调整 state"。组件测试在旧代码（effect 版本）和新代码上都通过，删掉新的重置逻辑后会失败。
> 4. "挂载/参数变化时加载数据"的 9 处 effect 按约定逐行加 `eslint-disable-next-line … -- … replaced by the FE-03 data layer`，**FE-03 引入数据层后应删除这些注释**。届时如果遗漏，ESLint 会把多余的 disable 报为警告，CI 会失败。**（已随 FE-03 全部删除）**
> - 清理 `exhaustive-deps` 警告时发现并修复 **BUG-12**（删除最后一张章节图片后崩溃）。`BookDetailPage` 的 `loadBook` 只依赖 `id`，不存在读到旧值的问题，随第 4 项加 disable。
> - 浏览器冒烟测试（临时库）：主题切换；书、章、想法、摘录表单的编辑预填与新增空表单；讲解和书评保存后回到阅读模式、再次编辑时预填；摘录阅读器切换时关闭菜单；书单面包屑菜单在切换选中时关闭；7 个页面加载无控制台错误。

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

> **✅ 已完成（2026-11-01）**，分两个提交：① 后端聚合接口；② 前端数据层。
> **① 后端聚合接口**：新增 `GET /api/books/{id}/detail`（[BookDetailService](../../backend/src/main/java/com/bookscoreideas/service/BookDetailService.java)），一次返回：
> - `book`、`parts`、`chapters`。每章包含 `keyIdeas`、`excerpts` 列表、`imageCount`、`hasExplanation`；
> - `bookmarks`：最新的在前；
> - `marks`。
>
> 各部分内容与原来的细粒度接口完全相同（那些接口保留不动）。
> - 设计选择：
>   - 摘录给**完整列表**，不只给数量。原页面一打开就加载全部摘录（用于 📖 角标和阅读器），这样数据量不变，只是请求从 N 个变成 1 个；
>   - 图片只给数量。原页面也只用数量，打开图片查看器时才加载列表；
>   - `parts` 总是返回，前端只在 PARTS 书中使用（与原来"非 PARTS 书不显示 parts"的效果相同）。
> - 测试 [BookDetailApiTest](../../backend/src/test/java/com/bookscoreideas/books/BookDetailApiTest.java)：
>   - 与各细粒度接口的组合结果逐字段相等；
>   - 不存在的书返回 404；
>   - **语句数不随章节数增长**：1 章和 6 章都是 12 条，每章都带想法、摘录、图片、讲解、书签、标记。把摘录改回逐章查询后，测试失败（17 ≠ 12）。
> - 真实数据副本：
>   - 2,748 个 GET 响应中，只有新增的 24 个 `detail` 不同（旧版 404 → 200），各表不变；
>   - 新增 [check_detail.py](../../tools/rehearsal/check_detail.py)：24 本书的 `detail` 都等于细粒度接口的组合，想法和摘录的顺序也一致；
>   - 最大的书有 67 章：原来打开详情页要发 70 多个请求；现在 1 个，168 KB，约 20 ms。
>
> **② 前端数据层（TanStack Query）**：所有读取都放在 [queries.js](../../frontend/src/queries.js) 的 hook 中（`useBooks`、`useBookDetail`、`useIdeaSearch` 等），`main.jsx` 提供 `QueryClient`。
> - 设计选择：
>   - **缓存策略**：`staleTime` 30 秒。写操作后调用 `refresh()`，让**全部**查询失效：屏幕上的立即重新获取，其他的下次显示时再获取。
>     - 写操作仍然直接调用 api.js，`refresh()` 放在原来调用 `loadX()` 的位置，所以先后顺序不变（原来 await 的地方仍然 await）。
>     - 没有把失效放进 `apiFetch` 的隐式钩子：那样会让旧的逐条导入循环在每次写之后都重新获取一次，而且对 mock 了 `../api` 的组件测试不可见。
>     - "全部失效"比逐个列出受影响的键简单，也不会漏，例如在详情页标星后，想法库要更新。代价是屏幕上的一两个查询多获取一次，本地应用可以接受。
>   - **即时反馈**：评分、阅读状态、章节拖到其他 Part、保存/删除标记、书签、讲解标志、删除摘录，先用 `setQueryData` 更新缓存，再由 `refresh()` 以服务器为准。失败时 `refresh()` 会恢复服务器上的值，代替原来的手工回滚。
>   - **讲解正文不放进查询缓存**，仍在打开时请求一次，保存在弹窗状态中：`ChapterExplanationModal` 每次收到新的 `explanation` 引用，都会重置草稿、编辑模式和滚动位置。放进会自动重新获取的缓存后，保存书签或标记触发的重新获取可能把读者"踢回"开头。
>   - 详情页按书 `key`（`App.jsx` 的 `BookDetailRoute`）：切换书时展开状态、弹窗等不会带到另一本书。
>   - 重试：4xx 不重试（例如书已被删除），其他错误重试 1 次。查询都传入 `signal`，离开页面时会取消未完成的请求。
>   - 想法库、摘录库的防抖改为 `useDebouncedValue` + 以参数为键的查询。原来挂载时会连发两次相同的搜索，现在只发一次。
> - 删除了 FE-02 留下的 **9 处** `FE-03 data layer` eslint-disable，lint 仍为 0 / 0。`ChapterImageViewer` 不再需要 `onImagesChange` 回调：上传/删除后 `refresh()`，详情页的图片角标自动更新。
> - 回归测试：新增 [BookDetailPage.test.jsx](../../frontend/src/pages/BookDetailPage.test.jsx) 和 [sharedBooks.test.jsx](../../frontend/src/pages/sharedBooks.test.jsx)，使用 fetch 层的假后端 [fakeBackend.js](../../frontend/src/test/fakeBackend.js)。它同时提供 `detail` 和全部细粒度接口，所以同一个测试能在新旧代码上运行。在旧代码上 4 个用例全部失败：
>   - 打开一本书只发 1 个请求。旧代码 5 章的书发 10 个；
>   - 展开章节不再请求。旧代码多发 `/ideas`；
>   - 快速切换书时，前一本书迟到的响应不会覆盖新书。旧代码会显示成 Book One；
>   - 在书库、想法库、摘录库之间来回切换，书列表只获取一次。旧代码获取 4 次。
>
>   `ChapterImageViewer.test`（BUG-12）、`forms.test` 只是补了 `QueryClientProvider`。前端测试 41 → 45。
> - 浏览器验证（真实数据副本，18084 + Vite 15173）：
>   - 打开 67 章的书只有 1 个 `detail` 请求。开发模式下 StrictMode 会先取消一次，日志显示 `ERR_ABORTED`，正好说明取消有效；
>   - 展开章节没有请求；标星后立即生效，并且在想法库中出现；
>   - 回到书库时书列表来自缓存，只请求了分类；评分立即生效；
>   - 摘录阅读器中删除第 2 条后显示"2 / 3"，角标 4→3，服务器上确实删除了；
>   - 讲解中"Mark read here"后，弹窗保持阅读模式和滚动位置，出现"Continue reading ~50%"和 🔖；
>   - 从阅读历史跳转，打开讲解并定位到 50%；
>   - 选中文本保存段落后，高亮出现，"Saved Passages (1)"；
>   - 上传图片后章节角标变为 🖼️ 1；
>   - 书单：选择文件夹后显示书；Remove 后列表和数量立即变为 3；
>   - 书评库正常；无页面错误。

- **详情页扇出**：[BookDetailPage.loadBook](../../frontend/src/pages/BookDetailPage.jsx) 先取章节列表，再对**每个章节**各请求一次 excerpts、一次 images（第 224–246 行）。50 章的书 = 100+ 个请求。
- **重复拉全库**：书库、想法库、摘录库、书评库、阅读历史 5 个页面都调用 `bookApi.getAll()`，而该接口返回每本书完整的章节+想法树（BE-02）。其它页面只是为了渲染"按书筛选"下拉框。**BE-02 已完成**：列表接口只返回书本身的字段和 `chapterCount`（真实数据下约 25 KB），这一条的代价已大幅降低；缓存和去重仍由本项负责。
- **"全部替换"导入**：先逐条 `DELETE` 再逐条 `POST`（第 623–683、1119–1129 行），中途失败会留下半成品。
- 每个页面自管 `loading/error`，切换页面全部重拉，无缓存、无请求取消（快速切书可能出现旧响应覆盖新数据的竞态）。
- FE-02 为 9 处"加载数据"的 effect 加了 `eslint-disable-next-line react-hooks/set-state-in-effect -- … FE-03 data layer`，完成本项时应一并删除（搜索 `FE-03 data layer`）。

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

> **🔄 进行中（2026-11-01）**
> **① 后端接口**：[JsonImportController](../../backend/src/main/java/com/bookscoreideas/controller/JsonImportController.java) / [JsonImportService](../../backend/src/main/java/com/bookscoreideas/service/JsonImportService.java)，每个请求一个事务（格式见 [api-conventions.md](../api-conventions.md)）：
> - `POST /api/books/import`：书库导入，书带 parts / chapters / keyIdeas / excerpts；
> - `POST /api/books/{id}/import`：详情页的 Chapters / Parts 标签页，ADD / REPLACE；
> - `POST /api/books/{id}/import/content`：Ideas (All)、Excerpts (All)，以及单章的 Ideas、Excerpts、Ideas + Excerpts。
>
> 设计选择（按最佳判断）：
> - **整个请求一个事务**：一次导入多本书时，任何一本不合法就全部不创建（与 ZIP 迁移"每本书一个事务"不同）。粘贴的 JSON 通常很小，改好再导入即可；也不会出现"半本书"。
> - **持久化与 ZIP 迁移共用**：新增 [BookTreeWriter](../../backend/src/main/java/com/bookscoreideas/service/BookTreeWriter.java)，从 `MigrationImporter` 中抽出 part / 章节 / 想法 / 摘录 / 讲解 / 书签 / 标记 / 图片的写入。书库导入直接复用 `MigrationImporter.persistBook`（在外层事务中运行，所以全部成功或全部回滚）。BE-06 的最后一项"两套 JSON 导入"随之解决。
> - **校验**：沿用逐条创建时的规则（`KeyIdeaRequest`、`ExcerptRequest` 等）。错误信息写明路径，例如 `books[1].chapters[0].excerpts[0].content: must not be blank`。未知字段照旧忽略，以前能导入的 JSON（包括"Export JSON"的输出）现在仍能导入。
> - **结构**：
>   - 有 `parts` 或 `structureType` 为 PARTS 的书是 PARTS 书。PARTS 书顶层的 `chapters` 作为未分组章节导入：原来前端会静默丢掉，ZIP 迁移的 `persistBook` 也是这样。现有归档不会出现这种组合，所以迁移行为不变；
>   - 向 CHAPTERS 书导入 `parts` 返回 400；
>   - REPLACE 先删除这本书全部的 part 和章节，按实体删除，所以章节图片文件会在提交后清理。
> - **内容导入的章节匹配**：
>   - 优先**完全匹配**（忽略大小写和首尾空格），其次才是"包含"。原来取列表中第一个"完全或包含"匹配的章节，所以"Chapter 1"可能匹配到排在前面的"Chapter 10"；
>   - 也可以直接给 `chapterId`，单章导入使用这种方式。如果该章节不属于这本书，返回 400。
> - **内容 REPLACE**：每个被点名的章节只清空一次，并且在任何添加之前完成。原来同一章节出现在两组里时，后一组会把前一组刚导入的内容删掉；只清空请求中给出的种类（ideas 或 excerpts）。
>
> 测试 [JsonImportApiTest](../../backend/src/test/java/com/bookscoreideas/books/JsonImportApiTest.java)（11 个）：
> - **BUG-06 回归**：书库导入保留每章的 excerpts（含 note / source）；
> - "Export JSON"的输出导入后，再导出**完全相同**；
> - PARTS 书的 parts 和未分组章节；
> - 不合法时一本都不创建，并写明字段路径；
> - 结构的 ADD、REPLACE（旧章节的内容也被删除），CHAPTERS 书拒绝 parts；
> - 404 / 未知 mode 返回 400；
> - "Chapter 1"不会匹配到"Chapter 10"；
> - REPLACE 只清空给出的种类，同一章节出现两次时内容都保留；
> - 未知章节、其他书的章节、空条目返回 400，且什么都不写入。
>
> 现有的迁移测试（`MigrationArchiveTest`、`ImageApiTest`）作为 `BookTreeWriter` 抽取的特征测试，改动前后都通过。后端测试 151 → 162。
>
> 真实数据副本：
> - 2,748 个 GET 响应**零差异**，各表不变；
> - 新增 [roundtrip.py](../../tools/rehearsal/roundtrip.py)，在空库实例上验证：
>   - **JSON**：24 本书的 export 经 `POST /api/books/import` 导入后再导出，**全部相同**；
>   - **ZIP**（检查重构后的迁移导入）：25 个条目中只有 book 195 的 `images` 5 → 0，与 BE-08 时相同，原因是图片文件不在本机。
> - BUG-06 复现：按旧书库导入的方式 `POST /books/{id}/chapters` 并带上 excerpts，存下 0 条；`POST /api/books/import` 存下 1 条。

书库与详情页的 JSON 导入都由前端循环调用 `create` 接口完成：一本 30 章、每章 10 个想法的书需要 300+ 次串行请求；中途任一失败会留下"半本书"，且没有回滚。两处实现不一致（BUG-06）。

**建议**：后端 `POST /api/books/import-json`（与 `MigrationImporter` 复用持久化逻辑，单事务），前端只做 JSON 解析与预览。
