# 畸形链接检测与修复（Malformed Link Fix）

## 背景问题

部分章节「解释（详解）」里，从 AI 对话（如 Copilot）导出的引用链接会被渲染成**一整条暴露的长 URL**，并在阅读弹窗里产生**难看的横向滚动条**；而另一些书的同类引用却渲染正常。

### 两个表现

| 书 | 现象 |
|---|---|
| End Times | `[[标签]]` 变成纯文本 + 整条 URL 裸露、横向滚动条 |
| Grit | 渲染为干净的文件名链接 |

## 根因

差别**不在 CSS，而在 markdown 源文的链接结构**（用项目自带的 `marked` 复现确认）：

- **End Times（坏）** —— 链接地址里又嵌套了一个链接，且标签用了双括号：

  ```
  [[标签]]( [显示URL](真实URL) )
  ```

  Markdown 规定链接地址（圆括号内）**不能再嵌套 `[文字](网址)`**。解析器放弃组装外层链接 → `[[标签]](` 变成纯文本，里面的裸 URL 被 GFM autolink 抓成链接 → 整条 URL 暴露。

- **Grit（好）** —— 是一串并排的、各自合法的 `[文字](网址)` 链接，每个 `]` 都紧贴 `(`，无嵌套：

  ```
  [Grit (Angela Duckworth) (](url)[z-library.sk](url)[,](url)...[).pdf](url)
  ```

  marked 渲染成一串 `<a>` 片段，拼起来正好是文件名，所以干净。

第二个问题（横向滚动条）：裸 URL 是不可断行的长字符串，而内容容器与其 `a` 之前没有 `overflow-wrap`，长串撑破容器。

## 解决方案

采用 **CSS 兜底 + 检测/提示/修复（方案 B）**。

### 1. CSS 兜底（治横向滚动条，与数据无关）

`frontend/src/index.css` —— 给内容容器及链接加断词：

```css
.review-bank-content { overflow-wrap: anywhere; }
.review-bank-content a { overflow-wrap: anywhere; word-break: break-word; }
```

`.review-reader-content` 继承自 `.review-bank-content`，阅读器与卡片列表都覆盖。即使出现畸形链接也只换行，**不再有横向滚动条**。

### 2. 检测与修复工具

`frontend/src/utils/linkFix.js`：

- `analyzeMarkdownLinks(text)` —— 粘贴时扫描**原始 markdown**，识别两类畸形：
  - 双括号标签：`[[Label]](…)`
  - 地址里嵌套链接：`[Label]([display](url)…)`

  折叠为规范的 `[Label](url)`。返回 `{ fixed, fixes }`。
- `analyzeHtmlLinks(html)` —— 扫描**已保存的 HTML**，把「字面括号文本 + 裸 URL 链接」修回规范链接（用于已存坏数据）。

实测：End Times 命中修复、Grit 零改动（markdown 与 HTML 两条路径均正确）。

### 3. 用户选择弹窗

`frontend/src/components/LinkFixPrompt.jsx` —— 列出每处 `原始 → 修复后` 预览，三个按钮：

- **自动修复**
- **保持原样**
- **取消**

无问题时仅提示「未发现需要修复的链接」。用户始终拥有最终决定权。

### 4. 接入编辑器

`frontend/src/components/RichTextEditor.jsx`：

- **粘贴拦截**：`handlePaste` 走 markdown 时先 `analyzeMarkdownLinks`，命中畸形即弹窗让用户选（同步 `return true` 吃掉粘贴，按钮回调再插入对应版本）。防住**未来**的坏数据。
- **扫描按钮**：工具栏链接组新增 🪹 按钮，对**当前已有内容**执行 `analyzeHtmlLinks` → 弹窗预览 → 修复。治**已存**的坏数据。

## 修复已有坏数据的操作步骤

打开该解释 → **Edit** → 点工具栏 🪹 按钮 → 弹窗预览 → **自动修复** → **Save**。

## 相关文件

- `frontend/src/utils/linkFix.js` —— 检测/修复核心
- `frontend/src/components/LinkFixPrompt.jsx` —— 选择弹窗
- `frontend/src/components/RichTextEditor.jsx` —— 粘贴拦截 + 扫描按钮
- `frontend/src/index.css` —— `overflow-wrap` 兜底 + 弹窗样式
