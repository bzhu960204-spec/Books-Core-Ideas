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

---

## 迭代二：Rich 粘贴仍然弄坏链接（autolink 污染 + 修复器反噬）

### 新症状

《Four Thousand Weeks》某章解释里,一条本来干净的引用被"修"成了下面这样的**可见文字**(不是渲染后的链接,而是字面量标签):

```
Four Thous...<a target="_blank" rel="noopener noreferrer nofollow" href="http://ibrary.sk">ibrary.sk</a>, | PDF
```

诡异之处:源文本只是一条普通的双括号链接,标签里**根本没有 `<a>`**:

```
[[Four Thous...ibrary.sk, | PDF]](https://dsvcorp-my.sharepoint.com/.../(Oliver%20Burkeman)%20(z-library.sk,.pdf)
```

### 定位过程(先复现,不猜)

用项目自带的 `linkFix.js` + `marked` 写脚本逐环复现,排除了几条错误假设后锁定真因:

1. **`marked` 不会** 把纯文本 `ibrary.sk` autolink(没有 `www.`/`http://` 前缀)。所以 Markdown 路径渲染出来是干净的,`http://ibrary.sk` 不可能来自 `marked`。
2. 截图里的 `target="_blank" rel="noopener noreferrer nofollow"` 是 **TipTap Link 扩展的默认 `HTMLAttributes`**(`extension-link/dist/index.js` 第 269–275 行:`linkOnPaste:true` / `autolink:true` / `target:"_blank"` / `rel:"noopener noreferrer nofollow"`)。StarterKit v3 已内置并启用 Link。
3. 用 `linkifyjs`(Link 的依赖)实测:`.sk` 是合法 TLD,所以标签里截断出来的 `ibrary.sk` 被判定为域名 `http://ibrary.sk`。

### 真正的因果链

1. **Rich 粘贴当场污染** —— Rich 模式下 `handlePaste` 直接 `return false`,文本交给 ProseMirror。TipTap 的 **autolink 在粘贴瞬间**扫描文本,把 label 里的 `ibrary.sk` 注入成 `<a href="http://ibrary.sk">`。于是**还没点任何按钮**,存进编辑器的 HTML 就已经是:
   ```
   [[Four Thous...<a href="http://ibrary.sk">ibrary.sk</a>, | PDF]](<a href="https://…sharepoint…pdf">…</a>)
   ```
   这个内嵌 `<a>` 不是源文里的,是编辑器自己造出来的。
2. **修复器把注入的 `<a>` 转义成文字** —— 点 🩹 扫描后,`analyzeHtmlLinks` 的 `HTML_BRACKET_LINK_RE` 把含 `<a>` 的整段当作 label 捕获,然后 `escapeHtml(label)` 把尖括号转义,`<a>` 就变成了可见的 `&lt;a&gt;…&lt;/a&gt;`——即截图那串垃圾。真正的 SharePoint 地址其实被正确抓到了,问题只出在 label 没剥标签。
3. **URL 不平衡括号** —— 文件名 `(z-library.sk,.pdf` 带一个没闭合的 `(`,导致 `readUrl` 的括号配平逻辑吞掉 Markdown 的收尾 `)`,甚至把外层终点算到行尾。

### 方案:粘贴解耦 + 关 autolink + 强化按钮

按"粘贴只粘贴、修复只在按钮"的解耦原则,配套三处改动:

1. **粘贴解耦**(`RichTextEditor.jsx`)—— 移除 `handlePaste` 里的 `analyzeMarkdownLinks` 拦截与 paste 弹窗;`LinkFixPrompt` 仅由 🩹 按钮触发。粘贴不再自动"处理"链接。
2. **关闭 autolink**(`RichTextEditor.jsx`)—— `StarterKit.configure({ link: { autolink: false, linkOnPaste: false } })`。粘贴/输入时 TipTap 不再偷偷改内容,从源头杜绝 `<a>` 注入。
   > 代价:普通 URL 不再自动成链,需用 🔗 按钮手动加链——与"显式可控"的解耦取向一致。
3. **强化按钮修复**(`linkFix.js`):
   - `analyzeHtmlLinks` 的 label 先 `stripTags` 再 `escapeHtml`,杜绝 `<a>` 变可见文字。
   - 新增 `collapseTextMarkdownLinks`:处理 autolink 关闭后 Rich 粘贴留在 DOM 里的**纯文本**畸形链接 `[[Label]](url)`,直接折叠成干净 `<a>`。
   - 新增 `findDestEnd` 并重写 URL/终点计算:对**不平衡括号**稳健——优先配平,配平失败则取本行最后一个 `)` 作为外层终点;URL 读取"不越过外层收尾括号"(`Math.min(readUrl().end, destClose)`),既保住 `(Oliver%20Burkeman)`,又不吞掉 Markdown 的 `)`。
   - `tryParseMalformed` 额外返回 `label` / `url`,供 HTML 与 Markdown 两条路径共用。

### 两条粘贴路径修复后的归宿

| 粘贴方式 | 粘贴后 DOM | 按钮如何修 |
|---|---|---|
| **Rich**(autolink 已关) | 纯文本 `[[Label]](url)` | `collapseTextMarkdownLinks` |
| **Markdown / Auto** | `marked` GFM 把裸 URL 变成 `<a>`(锚点形) | `HTML_BRACKET_LINK_RE` |

两条都得到 `<a href="真实URL">Four Thous...ibrary.sk, | PDF</a>`:href 正确、无 `<a>` 泄漏、无裸 URL;正常链接零改动。

### 复现/验证脚本要点(非持久,已清理)

- 用 `file:///…/linkFix.js` 直接 import 真实代码,配 `marked` ESM 与 `linkifyjs` 的 `find()` 验证 `.sk` 被判成链接。
- 注意真实引用**结尾只有一个 `)`**(即 Markdown 收尾),文件名本身是未闭合的 `(z-library.sk,.pdf`;构造测试输入时别多补一个 `)`,否则 href 会多带一个括号。

### 操作步骤(不变)

打开解释 → **Edit** → 🩹 → 预览 → **自动修复** → **Save**。粘贴阶段不再处理,一切交给按钮。
