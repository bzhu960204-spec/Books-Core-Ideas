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

> **✅ 已完成（2026-11-01）**：行为不变的重构，分 5 个提交：① 特征测试；② `RichTextEditor`；③ `ChapterExplanationModal`；④ `BookDetailPage`；⑤ `index.css`。
>
> | 文件 | 拆分前 | 拆分后 | 拆出的部分 |
> |---|---|---|---|
> | [BookDetailPage.jsx](../../frontend/src/pages/BookDetailPage.jsx) | 1049 | 483 | [pages/bookDetail/](../../frontend/src/pages/bookDetail/)：`useBookDetailData`（缓存数据 + 即时更新）、`useExplanationReader`（讲解、深链接、书签、段落）、`useChapterDrag`、`BookHeader`、`PartList`、`ChapterCard`、`ImportModals` + `jsonImportHints`、`explanationExport.js` |
> | [RichTextEditor.jsx](../../frontend/src/components/RichTextEditor.jsx) | 1029 | 144 | [components/richText/](../../frontend/src/components/richText/)：`pasteTransforms` / `codeRepairs`（纯函数，原样搬出）、`pasteHandlers`、`useCodeBlockRepairs`、`extensions` + `ResizableImageView`、`EditorToolbar`、`MoreToolbar`、`SelectionBubbleMenu` |
> | [ChapterExplanationModal.jsx](../../frontend/src/components/ChapterExplanationModal.jsx) | 531 | 175 | [components/explanation/](../../frontend/src/components/explanation/)：`useReaderPreferences`、`useReadingPosition`、`usePassageMarks`、`useFloatingMenu`、`ExplanationHtml`、`PassageMenu`、`ExplanationFooter` |
> | [index.css](../../frontend/src/index.css) | 3860 | 26（清单） | [styles/](../../frontend/src/styles/)：按原有分节切成 22 个文件，最大的 `collections.css` 621 行 |
>
> 设计选择（按最佳判断）：
> - **顺序与提交粒度**：先写特征测试并在旧代码上跑通（单独提交，可检出验证"改动前也通过"），再自底向上拆：编辑器 → 讲解弹窗（用到编辑器）→ 详情页（用到讲解弹窗）→ 样式。每个组件一个提交，便于单独回退。
> - **拆分边界**：纯函数原样搬出（只加 `export`），之后可以直接单测；状态和副作用按职责拆成 hook；JSX 拆成展示组件，元素、属性和顺序保持不变。各 hook 中 effect 的函数体不变，原来的局部 ref 变成 hook 参数后列入依赖（ref 对象不变，所以 effect 的执行时机不变）。
> - **入口文件不动**：`BookDetailPage`、`RichTextEditor`、`ChapterExplanationModal` 仍在原路径，调用方和测试中的 `vi.mock` 无需修改；拆出的部分放在同名的小写目录中。
> - **详情页的弹窗状态保留在页面中**（每个弹窗一个 `useState`，写操作也在页面）。合并成一个状态会改变"一个弹窗打开另一个"时的行为，例如删除摘录后阅读器重新打开。下一步若要继续缩小页面，可以让各表单弹窗自己负责保存。
> - **CSS 用普通 CSS 文件，不用 CSS Modules**：CSS Modules 需要改写几百处 `className`，而很多类名跨组件共用（`.btn`、`.empty-state`；`.chapter-summary` 也用于 Part；`.review-bank-content` 也用于讲解阅读器），还有全局的 `::highlight()`。
> - **CSS 不分散到各组件中 import**：层叠依赖源顺序，例如"Review Reader Modal"一节中针对编辑器的 `.rte-*` 规则必须排在编辑器一节之前，窄屏 `@media` 必须排在被它覆盖的规则之后。按组件 import 的顺序由模块图决定，与原顺序不同。所以 [index.css](../../frontend/src/index.css) 只保留字体 `@import`，再按原顺序 `@import` 各文件；文件头注释写明了顺序不能调整。FE-04 做代码分割时，如需按页面拆分 CSS，要逐条确认没有跨文件覆盖。
> - **主题**：没有单独的 `theme.css`。主题变量由 [themes.js](../../frontend/src/themes.js) 经 `ThemeContext` 写到 `:root`，CSS 中只有 `:root` 的默认值（与 Old Oak 相同），留在 `base.css`；CSS 中没有按主题区分的选择器。
>
> 测试：
> - 特征测试（在旧代码上全部通过，拆分后仍通过）：
>   - [BookDetailPage.behavior.test.jsx](../../frontend/src/pages/BookDetailPage.behavior.test.jsx)（22 个）：头部（阅读状态即时生效后以服务器为准、返回链接、JSON 下载）；章节、Part、想法、摘录的增删改及确切的请求；同时只展开一章；拖拽章节到其他 Part / 未分组；讲解导出的阅读顺序；Parts 导入；讲解、书签、段落和阅读历史深链接；
>   - `ChapterExplanationModal`（4 → 24 个）：字号上下限与记忆、全屏与 Esc、编辑时不随 Esc/点外部关闭、恢复阅读位置、书签、选中保存段落（备注、撤销、重复、失败）、浮动条位置、跳到段落、高亮开关；
>   - `RichTextEditor`（3 → 16 个）：Copilot 代码块的"Render"提示及其撤回、修复 Plain Text 代码块、Markdown 卡片截图的标记与转换、超大图片、图片文件、工具栏格式、链接、链接修复、外部值同步、清空。改用受控父组件渲染，与应用中的用法一致；
>   - 变异检查：改坏展开规则、Part 排序、浮动条偏移、代码行拼接，都会使测试失败。
> - 拆出后新增的单元测试：[pasteTransforms.test.js](../../frontend/src/components/richText/pasteTransforms.test.js)（9 个）、[explanationExport.test.js](../../frontend/src/pages/bookDetail/explanationExport.test.js)（3 个）。
> - 前端测试 52 → 119；lint 0 / 0。
>
> 验证：
> - **CSS**：`npm run build` 产出的 CSS 与拆分前**逐字节相同**（SHA-256 相同，文件名 `index-DzsAnc4e.css` 也相同）。
> - **浏览器对比**（真实数据副本，后端 18084）：在临时 worktree 中检出拆分前的 6662f7d，用第二个 Vite（15174）运行，与当前代码（15173）逐场景交替采集。5 个主题 × 18 个场景（书库三种视图；PARTS / CHAPTERS / 67 章的书；展开章节；图片；讲解阅读与编辑（含第二行工具栏）；摘录阅读器；段落面板；两种导入弹窗；想法库、摘录库、书评库、阅读历史、书单），共 305 屏：
>   - 逐节点的 DOM 签名（包括文本节点的边界）全部相同；
>   - 逐屏截图逐像素相同。书库页有 3 次不一致，DOM 也不同，原因是外部封面图片加载时序；重跑 2–3 次后都相同。
>   - 这一对比发现过一处差异：`PartList` 中用模板字符串合并了 "2"、" "、"chapters" 三个文本节点。序列化后的 HTML 相同，但字形位置有次像素偏移。已改回原写法，所以 DOM 签名要包含文本节点边界。
> - **交互**（新代码，写入副本）：选中文本保存段落（高亮、计数 0→1）并撤销；拖拽章节到另一 Part 再拖回（悬停高亮，与旧代码行为相同）；添加并删除想法；编辑并保存讲解后回到阅读模式；无页面错误。
>
> 写特征测试时发现两个现存缺陷，没有在本项中修改：[BUG-15](01-verified-bugs.md#bug-15)（撤销保存段落失败时没有提示）、[BUG-16](01-verified-bugs.md#bug-16)（字体、字号、颜色控件无效）。

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
>
> **③ 后续修正（单独提交）**：前端现在会取消不再需要的请求（开发模式下的 StrictMode、切换页面）。如果取消发生在服务器写响应的过程中，Tomcat 抛出 `AsyncRequestNotUsableException`，而全局异常处理的兜底分支会把它当作"Unhandled exception"，记录 ERROR 和完整堆栈，并试图返回 500。浏览器验证期间日志里出现过一次。
> - 修正：[GlobalExceptionHandler](../../backend/src/main/java/com/bookscoreideas/web/GlobalExceptionHandler.java) 单独处理该异常，只记 debug 日志。较新的 Spring 版本会在基类中处理它，升级（BE-10）时如果映射冲突，启动就会失败，届时删掉即可。**BE-10 已删除**：Spring 6.2 的基类接管了它（升到 3.5.16 时果然启动失败），测试不变。
> - 测试 [ClientAbortTest](../../backend/src/test/java/com/bookscoreideas/web/ClientAbortTest.java)：修复前返回 500 并记录"Unhandled exception"。
> - 在真实数据副本上快速来回打开两本书 24 次，日志中没有 ERROR。

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

> **✅ 已完成（2026-11-01）**：首屏 JS 从 1,249 KB（gzip 380 KB）降到 311 KB（gzip 97 KB）。编辑器、Markdown 渲染、jszip 等只在用到时加载。
>
> | 产物 | 之前 | 之后 | 何时加载 |
> |---|---|---|---|
> | 首屏：`index` + `jsx-runtime` + `Modal` | 1,249 KB（单个 chunk） | 301 + 9 + 1 KB | 打开应用 |
> | `RichTextEditor`（TipTap + ProseMirror） | （在首屏中） | 542 KB | 第一次进入编辑（讲解或书评） |
> | `lib`（react-markdown 一系） | 〃 | 115 KB | 第一次打开书、想法库或摘录库 |
> | `ExplanationExportModal`（jszip） | 〃 | 111 KB | 第一次点"Export Explanations" |
> | `BookDetailPage` / `reviewContent`（marked）/ `sanitizeHtml`（DOMPurify） | 〃 | 54 / 42 / 29 KB | 第一次打开书 |
> | 其余页面、`BookMigrationModal` | 〃 | 3–17 KB | 第一次打开时 |
> | CSS | 60.58 KB | 不变（逐字节相同） | 打开应用 |
>
> 设计选择（按最佳判断）：
> - **路由级**：除首屏书库外的 6 个页面用 `React.lazy`，[App.jsx](../../frontend/src/App.jsx) 中在 `<main>` 内放一个 Suspense，回退界面沿用现有的 `.loading`（侧边栏不受影响）。
> - **组件级**：[LazyRichTextEditor](../../frontend/src/components/LazyRichTextEditor.jsx) 替代 3 处直接引用（讲解弹窗、书评库、书评阅读弹窗），回退显示"Loading editor"。`ExplanationExportModal`、`BookMigrationModal` 在打开时加载，回退为空，避免在页面中闪出加载提示。
> - **不手工拆 vendor chunk、不预取**：rolldown 自动生成共享 chunk（如 `lib`）；本地服务加载一个 chunk 只需几毫秒。
> - **首屏 301 KB，比目标（< 300 KB）多 1 KB**：首屏 chunk 中约 93% 是框架（react-dom、react-router、TanStack Query），应用自身只剩书库页及其弹窗。再把书库的几个弹窗也改成懒加载可以降到 300 KB 以下，但只少约 3%，还会让常用弹窗多一次加载，所以没有这样做。
> - **旧 chunk 失效**：打开着页面时重新构建（prod 的 jar 直接从 `frontend/dist` 提供文件，缺失的文件会回退成 index.html），页面会请求已不存在的 chunk。这是代码分割带来的新问题。[chunkReload.js](../../frontend/src/chunkReload.js) 监听 Vite 的 `vite:preloadError`，自动刷新一次；10 秒内再次失败就不再刷新，让错误照常抛出，避免循环刷新。
>
> 开发模式下发现并修复的问题：TipTap 3 的 `useEditor` 默认在**渲染时**创建编辑器，并在 1 ms 后销毁未挂载的实例。懒加载的组件在 Suspense 恢复时提交，React 19 会把这次提交推迟（最多约 300 ms），编辑器因此在挂载前就被销毁，值同步 effect 随后调用 `getHTML()` 报错，编辑器无法显示（只在懒加载后出现）。现在给 `useEditor` 传 `immediatelyRender: false`，在挂载后才创建编辑器。回归测试 [LazyRichTextEditor.test.jsx](../../frontend/src/components/LazyRichTextEditor.test.jsx)：在 StrictMode 下渲染真实的懒加载编辑器，修复前等待 10 秒仍没有编辑器。
>
> 测试（126 → 130）：
> - 新增 [App.test.jsx](../../frontend/src/App.test.jsx)（直接打开懒加载页面的 URL；从书库导航到想法库）、[chunkReload.test.js](../../frontend/src/chunkReload.test.js)（刷新一次、10 秒内不再刷新、之后可以再次刷新），以及上面的回归测试；
> - 编辑器、导出弹窗变为异步出现：相关测试中首次出现的查询改为 `findBy`，懒加载页面的首次加载给 5 秒，因为并行运行时导入整个页面模块较慢。用 3 个随机种子打乱顺序运行，结果都通过，说明不依赖"前一个测试已加载过模块"。
>
> 验证：
> - 开发模式：改动前（ca48d4f，worktree + Vite 15174）与改动后（15173）用 [ui-compare.js](../../tools/rehearsal/ui-compare.js) 对比，2 个主题 × 18 个场景（122 屏）的 DOM 签名和截图全部相同；各页面和编辑流程无页面错误。
> - 生产构建（`vite preview`，代理到真实数据副本）：
>   - 按网络请求确认各 chunk 在上表所列时机才加载；进入编辑后 Markdown 粘贴正常；
>   - 让 ReadingHistoryPage 的 chunk 返回 404，或返回 index.html（模拟 jar 的回退）：都只自动刷新一次；仍然失败时错误照常抛出，此时主区域为空白，需要 FE-05 的 ErrorBoundary；恢复后刷新，页面正常。
>   - 刷新前会短暂报一次错（`reading 'default'`）：阻止默认处理后 `import()` 得到 undefined，React.lazy 随即报错，页面紧接着刷新。加上 ErrorBoundary 后这里只会短暂显示错误界面。

单 chunk 1.19MB。TipTap（含 ProseMirror）、`marked`、`react-markdown`、`jszip` 都打进了首屏，即使只打开书库列表。

**建议**：
- 路由级 `React.lazy`：除 `LibraryPage` 外的页面懒加载；
- `RichTextEditor`、`ExplanationExportModal`（jszip）、`BookMigrationModal` 按需 `import()`；
- 目标：首屏 chunk < 300KB。

---

<a id="fe-05"></a>
## FE-05 · 错误处理与交互反馈不一致 🟡

> **✅ 已完成（2026-11-01）**：写操作失败一律提示，并保留用户的输入；页面渲染出错不再白屏；未知地址和不存在的书有 404 页面；确认统一使用应用自己的对话框。
>
> 开工前的盘点（FE-03 之后，原先的 6 处 `.catch(() => {})` 大多已随数据层消失，但吞错换了形式）：
> - **约 20 个写操作的 `await` 没有 try/catch**（详情页的增删改、星标、书库删除和评分、表单保存、`BookForm` 的分类、图片删除、讲解的保存/删除/书签）：失败时只有一条未处理的 Promise 拒绝，用户看不到任何提示，表单或确认框停在原处，没有任何说明。
> - **`catch { /* ignore */ }` 或只有 `console.error`**：书评库保存/新建/删除、阅读历史删除、详情页导出 JSON、书单拖放和移出、加入书单弹窗、图片上传。
> - **原生对话框**：7 处 `alert`（书单 ×3、选书、讲解导出 ×2、编辑器 5 MB 提示；书单和选书用的是"Operation failed, please try again."这类不说明原因的文字），1 处 `window.confirm`（删除书单）。
> - **没有确认就删除**：讲解阅读器的"🗑️ Delete"一点就删除整篇讲解及其保存的段落；图片查看器的删除按钮同样。其他删除都有 `ConfirmDialog`。
> - 另外发现 3 个超出"没有提示"的缺陷，各自单独修复（见 [01-verified-bugs.md](01-verified-bugs.md)）：BUG-17（书评保存失败后像已保存一样退出编辑）、BUG-18（讲解打开失败时以空白编辑器打开，保存会覆盖原讲解）、BUG-19（加载失败显示成空状态，如书库显示"Your library is empty"）。
>
> 设计选择（按最佳判断）：
> - **Toast 自己写，不引入库**（[components/feedback/toast.js](../../frontend/src/components/feedback/toast.js) + [Toaster.jsx](../../frontend/src/components/feedback/Toaster.jsx)，共约 90 行）。只需要"错误"和"提示"两种，库（sonner、react-hot-toast）的大部分功能用不上，还要单独配主题；自己写的直接用主题的 CSS 变量，不增加依赖。存储放在 React 之外（`useSyncExternalStore` 订阅），因为编辑器的粘贴处理、全局 `unhandledrejection` 监听都不在组件里。相同的消息不叠加（重新计时），最多显示 4 条；错误 8 秒、提示 4 秒，可手动关闭。`z-index: 10000`，高于图片查看器等全屏层（9999）。没有 toast 时 `<Toaster>` 不渲染任何元素，所以页面 DOM 不变。
> - **统一的写操作约定**：失败时显示"做什么失败 — 原因"（如 `Could not delete the chapter — Chapter not found: 5`，原因来自后端 ProblemDetail 的 `detail`），**表单或确认框保持打开、输入保留**，可以直接重试。成功后才关闭。实现为 `attempt(action, write)`：成功返回 true，失败时报告并返回 false。需要让调用方知道失败的（讲解保存、书签），报告后再抛出，由弹窗留在编辑状态 / 不显示"✓ Saved"。已有的就地错误提示（JSON 导入、迁移、保存段落、封面查询）不改，它们已经清楚。
> - **兜底**：`main.jsx` 注册 `unhandledrejection` 监听，任何漏掉的失败显示"Something went wrong — 原因"（忽略请求取消 `AbortError`）。
> - **网络错误可读**：[api.js](../../frontend/src/api.js) 把 `fetch` 本身的失败（浏览器只给 "Failed to fetch"）和开发代理在后端停止时返回的空 502/503/504 都变成 `Cannot reach the server. Is the backend running?`。各列表页的加载错误因此也从"Request failed: 502"变成这句话。
> - **ErrorBoundary 两层**（[ErrorBoundary.jsx](../../frontend/src/components/feedback/ErrorBoundary.jsx)）：
>   - **页面级**，在 `<main>` 内包住 Suspense 和路由：出错时只替换主区域，侧边栏仍可用；
>   - 离开该页面即清除错误。实现是比较 `pathname`（`resetKey`），**不用 `key`**：用 key 会在每次导航时重建 Suspense，懒加载页面就会先闪出"Loading"，而不是像现在这样在过渡期间保留旧页面；
>   - **根级**包住整个应用，作为最后一道防线（侧边栏本身出错时）；
>   - 不在组件内再加边界：草稿状态都在编辑器之外（父组件），而 chunk 加载失败时自动刷新会丢掉页面状态，组件级边界也保不住。
> - **chunk 加载失败**（FE-04 遗留）：识别浏览器的几种报错文字（`dynamically imported module` / `Importing a module script failed` / Vite 的 `Unable to preload CSS`），显示"This page could not be loaded … Reload"，不提供 Try again（`React.lazy` 会缓存失败的 import，只有刷新才能重新获取）。[chunkReload.js](../../frontend/src/chunkReload.js) 已开始自动刷新时（`isReloadingForChunk()`），边界只显示"Reloading"，FE-04 中记录的那次短暂报错不再闪出错误界面。其他错误显示"Something went wrong"、Try again / Reload / Back to Library，以及可展开的错误详情。
> - **404**：`<Route path="*">` 显示 [NotFoundPage](../../frontend/src/pages/NotFoundPage.jsx)（不懒加载，chunk 出问题时也能显示）；`/book/abc` 这种非数字 id 直接显示"Book not found"，不发请求；`/book/999` 由详情接口的 404 判断。详情加载的其他失败（500、网络）不再也显示成"Book not found"，而是显示原因和 Retry（[LoadError](../../frontend/src/components/feedback/LoadError.jsx)）。
> - **确认框统一**：[ConfirmDialog](../../frontend/src/components/ConfirmDialog.jsx) 增加执行中状态（两个按钮禁用，慢的删除不会发两次）、可选的标题和按钮文字；Esc 在捕获阶段处理并停止传播，只关闭确认框，不再连带关闭下面的阅读器或面板。删除书单改用它；讲解删除、图片删除新增确认。
> - **不改 `window.prompt`**（编辑器的链接地址输入）：它是输入框而不是提示或确认，换掉需要做一个链接编辑浮层，属于编辑器功能，不在本项范围内。
>
> 测试（130 → 169）：
> - 新增：[toast.test.js](../../frontend/src/components/feedback/toast.test.js)（计时、去重、上限、`attempt`、兜底忽略取消）、[api.test.js](../../frontend/src/api.test.js)（detail、网络失败、空 502、取消）、[ErrorBoundary.test.jsx](../../frontend/src/components/feedback/ErrorBoundary.test.jsx)（Try again、换页清除、chunk 失败、刷新中）、[ConfirmDialog.test.jsx](../../frontend/src/components/ConfirmDialog.test.jsx)（执行中禁用、Esc 不传到下层）、[BookDetailPage.failures.test.jsx](../../frontend/src/pages/BookDetailPage.failures.test.jsx)（表单保留输入、确认框保留并可重试、服务器不可达、导出、讲解保存/删除失败）、[CollectionsExplorer.test.jsx](../../frontend/src/components/collections/CollectionsExplorer.test.jsx)（不再调用 `window.confirm` / `alert`）；[App.test.jsx](../../frontend/src/App.test.jsx) 加 404 的三种情况、加载失败与 Retry、页面抛错时侧边栏可用且换页恢复；书库、图片查看器、讲解弹窗各加失败用例；
> - [fakeBackend](../../frontend/src/test/fakeBackend.js) 增加 `fail(method, path)`：让指定请求返回 ProblemDetail 错误或网络失败；
> - 行为有意改变而更新的测试：5 MB 提示从 `alert` 改为 toast（3 处）；讲解删除、图片删除多一步确认（4 处）。
> - 用 2 个随机种子打乱顺序运行，均通过（toast 存储是模块级状态，测试在 `afterEach` 中 `clearToasts()`）。
>
> 验证（真实数据副本，后端 18084）：
> - 改动前（a94dc8d，worktree + Vite 15174）与改动后（15173）用 [ui-compare.js](../../tools/rehearsal/ui-compare.js) 对比 5 个主题 × 18 个场景，305 屏的 DOM 签名和截图**全部相同**（正常状态下的界面不变）。
> - 浏览器中逐项确认（开发模式，用 Playwright 拦截请求制造失败，不改动数据）：
>   - 三种 404 页面；详情接口返回 500 时显示原因和 Retry，放行后 Retry 正常加载；
>   - 讲解删除确认显示在阅读器之上，Esc 只关闭确认框；删除返回 500 时 toast 显示原因，确认框和阅读器都保留；
>   - 图片删除确认显示在全屏查看器之上，确认期间方向键不翻页；删除失败的 toast 在最上层；
>   - 删除书单出现应用的确认框，没有原生对话框；
>   - **真的停掉后端**：开发代理返回 502，新建章节提示 `Could not save the chapter — Cannot reach the server. Is the backend running?`，表单中的输入还在；
>   - 开发模式下让 ReadingHistoryPage 模块返回 404：主区域显示"This page could not be loaded"，侧边栏可用，切到其他页面后恢复。
> - 生产构建（`vite preview`，输出到临时目录，不动 `frontend/dist`）：让 ReadingHistoryPage 的 chunk 返回 index.html（模拟 jar 的回退），记录到的界面依次为"Reloading" → 自动刷新一次 → "This page could not be loaded"，中间没有错误界面闪现；恢复后点 Reload，页面正常。
> - 首屏 JS 311 → 316 KB（gzip 97 → 99）：多出的是 toast、ErrorBoundary、404 页和 LoadError。`toast.js` 同时被首屏和编辑器 chunk 引用，rolldown 因此把首屏的共享代码另分成 `queries`、`api` 两个 chunk（首屏共 5 个文件，由 index.html 预加载）。CSS 多了 [styles/feedback.css](../../frontend/src/styles/feedback.css)（放在 index.css 最后；只有新类名，不覆盖已有规则）。

- 6 处 `.catch(() => {})` 静默吞错（如各页面加载书列表）；多处 `catch { console.error(...) }` 用户无感知。
- 确认/提示混用：自有 `ConfirmDialog` 与 `window.confirm` / `window.alert`（`CollectionsExplorer`、`PickBooksModal`、`ExplanationExportModal`、`RichTextEditor`）。
- 没有 React Error Boundary：任一组件抛错整页白屏。
  - FE-04 之后多了一种情况：懒加载的 chunk 加载失败、自动刷新一次后仍然失败时，错误会抛出到 React（见 FE-04 的"旧 chunk 失效"）。ErrorBoundary 应当在这里显示"重新加载"之类的提示。
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

> **✅ 已完成（2026-11-01）**，分两个提交：① 后端接口；② 前端改用。
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
>
> **② 前端改用**：书库页和详情页的 6 种导入（书库、Chapters / Parts、Ideas (All)、Excerpts (All)、单章 3 个标签页）都改为**一个请求**。请求体由 [utils/jsonImport.js](../../frontend/src/utils/jsonImport.js) 的纯函数生成，两个页面共用。
> - 共删除约 190 行逐条创建/删除的循环；`api.js` 新增 `importApi`，并删除因 FE-03 / FE-08 不再使用的 7 个读取函数（后端接口保留）。
> - 前端只保留服务器无法发现的形状检查：
>   - Chapters 标签页收到带 `chapters` 数组的对象（Parts 结构），服务器会忽略未知字段，所以由前端拦截；
>   - Ideas / Excerpts (All) 每组必须有 `chapter` 和对应的数组。
>
>   字段校验交给服务器，错误信息带路径。
> - 书库导入的提示示例补上了 `excerpts`。README 的导入说明已同步：全部成功或全部不导入、标题匹配规则、Replace 只清空给出的种类、单章按钮是 `{}`（原文写作 ⬇）、章节 summary 不限长度（原文误写 1000）。
> - 回归测试（在旧代码上都失败）：
>   - [LibraryPage.test.jsx](../../frontend/src/pages/LibraryPage.test.jsx)：整本书（含 excerpts）只发一个 `POST /api/books/import`。旧代码依次 POST 书、章节、想法，**excerpts 根本没有发出去**，这正是 BUG-06；
>   - `BookDetailPage.test.jsx` 新增 2 个：单章"Ideas + Excerpts"的 Replace All，以及 Ideas (All) 按标题导入，都只发一个 `/import/content`。旧代码会先 GET 再逐条 DELETE、POST；
>   - [jsonImport.test.js](../../frontend/src/utils/jsonImport.test.js) 测试 4 组请求体映射。
>
>   前端测试 45 → 52。
> - 浏览器验证（真实数据副本）：
>   - 书库导入带 excerpts 的书，书数 24→25，详情页角标 📖 2 / 📖 1，想法也在；
>   - 一次导入两本书、其中一本有空摘录：错误显示 `books[1].chapters[0].excerpts[0].content: must not be blank`，另一本也**没有**被创建；
>   - Chapters 标签页粘贴 Parts 结构被拦截；添加章节成功；
>   - Ideas (All) 用小写标题 `two` 匹配到 "Two"；
>   - 单章"Ideas + Excerpts"Replace All 只给 excerpts：摘录 2→1，想法保留；
>   - 67 章的 PARTS 书：添加空 part 成功，Replace All 后只剩新的 part 和章节；
>   - book 195 的图片文件缺失，对它 Replace 仍正常完成。

书库与详情页的 JSON 导入都由前端循环调用 `create` 接口完成：一本 30 章、每章 10 个想法的书需要 300+ 次串行请求；中途任一失败会留下"半本书"，且没有回滚。两处实现不一致（BUG-06）。

**建议**：后端 `POST /api/books/import-json`（与 `MigrationImporter` 复用持久化逻辑，单事务），前端只做 JSON 解析与预览。
