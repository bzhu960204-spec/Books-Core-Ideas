# 章节讲解阅读器的大纲

> 2026-11-13。在章节讲解（Explanation）阅读器里加一个标题大纲，读长文时可以快速跳到某一节。参考了 AI Knowledge Vault 笔记右侧的 Outline，但这里的大纲不常驻，不占阅读空间。

## 1. 要解决的问题

AI 生成的讲解往往很长，标题层级也深（h1–h4）。原来只能靠滚动条找位置，也没有目录。导出的单章 HTML 已经有目录抽屉（`buildChapterHtml.js` 的 `injectHeadingAnchors`），但在应用内阅读器里没有。

## 2. 交互

- 只在**阅读模式**、且讲解里有**至少 3 个**标题时，底部工具栏才出现 `☰ Outline` 按钮（在 Images 按钮后面）。编辑模式不显示；点 Edit 时会先收起大纲。
- 默认不显示。点按钮后，大纲以**悬浮面板**盖在正文右侧，不挤压正文，所以字号、排版、已保存的阅读位置都不受影响。
- 点击某一项：平滑滚动到该标题，面板自动收起。
- 面板打开时：高亮当前阅读到的标题（最后一个已滚到正文顶部的标题，留 24px 余量；还没读到第一个标题时高亮第一项），并把高亮项滚动到面板可见范围内。
- 关闭方式：再点一次按钮、点面板外、按 Esc。Esc 只关大纲，不会同时关掉弹窗。
- 缩进按相对层级计算（`depth = level - 最浅层级`），所以讲解从 h2 或 h3 开始时第一项不会被缩进。长标题用省略号截断，悬停显示全文。
- 面板定位在“文字区”里，而不是整个弹窗右侧，因此打开图片侧栏时不会盖住图片。窄屏（<900px，布局变成上下排列）同样可用。

## 3. 实现

| 文件 | 作用 |
|---|---|
| `frontend/src/utils/explanationOutline.js` | 纯函数。`extractOutline(html)` 用 `DOMParser` 解析已净化的 HTML，返回 `[{ index, level, depth, text }]`；`activeEntryIndex(tops, margin)` 算当前阅读到的条目。`OUTLINE_SELECTOR`（`h1, h2, h3, h4`）、`MIN_OUTLINE_ENTRIES`（3）也在这里 |
| `frontend/src/components/explanation/ExplanationOutline.jsx` | 悬浮面板组件：监听正文滚动更新高亮、Esc / 点击面板外关闭、点击跳转 |
| `frontend/src/components/ChapterExplanationModal.jsx` | 用 `useMemo` 从 `explanationHtml` 提取大纲；持有 `outlineOpen`；把正文外包一层 `.reader-text-pane`（`position: relative`）用来定位面板 |
| `frontend/src/components/explanation/ExplanationFooter.jsx` | 加 `☰ Outline` 按钮（新增 props：`hasOutline`、`outlineOpen`、`onToggleOutline`） |
| `frontend/src/styles/reader-modal.css` | `.reader-text-pane`、`.reader-outline`、`.reader-outline-item` 样式 |

### 几个设计要点

- **不改正文 DOM。** 讲解的标记（划线）锚点按正文文本偏移计算，约定“DOM 从不修改”（见 `utils/explanationAnchor.js`）。所以大纲不给标题加 id，而是用**下标**对应：`extractOutline` 返回的 `index` 就是标题在 `OUTLINE_SELECTOR` 匹配结果里的位置，跳转时用 `contentRef.current.querySelectorAll(OUTLINE_SELECTOR)[index]` 找到真实元素。渲染出来的 HTML 和提取大纲用的是同一份 `explanationHtml`，两边顺序一致。
- **空标题保留下标。** 文本为空的标题不进大纲，但仍占一个 `index`，避免后面的条目错位。
- **按钮和“点击外部关闭”不打架。** 点击外部关闭用的是捕获阶段的 `pointerdown`，会误把点 Outline 按钮当成“点外部”。所以按钮带 `data-outline-toggle`，面板忽略来自它的点击，由按钮自己负责开关。
- **Esc 优先级。** 和全屏模式一样，在 `document` 捕获阶段监听并 `stopPropagation`，先于 `Modal` 的 Esc 处理。
- **只在打开时监听滚动。** 面板没打开就不挂载，没有滚动监听的开销。

## 4. 没有做的

- “固定成右侧栏”的选项。现在只有悬浮面板；如果要加，偏好可以放进 `useReaderPreferences`（和字号、图片面板一样存 localStorage），且开着图片侧栏时仍应只能悬浮。
- 键盘快捷键。
- 大纲折叠 / 展开子级。

## 5. 测试

- `frontend/src/utils/explanationOutline.test.js`：层级与缩进、空标题与下标对齐、无标题、当前阅读位置的计算。
- `frontend/src/components/ChapterExplanationModal.test.jsx`（`ChapterExplanationModal outline`）：标题太少时不出现按钮；点开后列出标题、点击跳转到对应标题并收起；Esc 只关大纲不关弹窗；再点按钮会收起而不是立刻重新打开。

验证：在 `frontend` 目录下 `npm test`（43 个文件、393 个用例通过）和 `npm run lint` 均通过。注意要在 `frontend` 目录里运行，在仓库根目录用 `npx vitest` 会缺少 jsdom 配置。
