# Saved Passages 第二轮：滚动条样式、最大化、文字遮挡、单条专注编辑

状态：已实现（前端）
范围：仅前端（`frontend/`）。后端接口、数据库都不改，不新增 npm 依赖
前置：[saved-passages-chapter-layout](../saved-passages-chapter-layout/README.md)（左右两栏布局、通用 Modal 头部固定）已实现

---

## 1. 问题

| # | 问题 | 范围 |
| --- | --- | --- |
| 1 | 滚动条是浏览器默认样式（白色轨道 + 灰色粗滑块 + 上下箭头），与各主题的米色/深色背景不搭，显得粗糙 | 全项目 |
| 2 | Saved Passages 对话框不能最大化，摘录多、引文长时显得挤 | Saved Passages |
| 3 | 非最大化时，右栏文字和按钮紧贴滚动条，斜体引文的最后一个字被裁掉一部分（截图中 “控制”“当天” 等） | Saved Passages |
| 4 | 查看 / 写 note 时永远是一整列摘录，没法聚焦于某一条高亮内容，专心阅读、思考并写批注 | Saved Passages |

四项相互独立，可以分别实现、分别合入。建议顺序：§3 → §4 → §5 → §6。

## 2. 现状

| 位置 | 现状 |
| --- | --- |
| [base.css](../../../frontend/src/styles/base.css) | 没有任何滚动条样式（全项目搜索不到 `scrollbar-color` / `::-webkit-scrollbar`）；`body` 有 `scrollbar-gutter: stable` |
| [themes.js](../../../frontend/src/themes.js) | 5 个主题，其中 `midnight` 为深色；主题通过 CSS 变量（`--text-secondary`、`--bg-card`、`--border` 等）生效 |
| [Modal.jsx](../../../frontend/src/components/Modal.jsx) | × 为 `.modal-close`（`position: absolute`），没有放其它头部按钮的位置；每个 Modal 各自在 `document` 上监听 Esc |
| [passages.css](../../../frontend/src/styles/passages.css) `.marks-content` | `overflow-y: auto`，**没有右侧内边距**；`.marks-quote` 为斜体、只有左内边距 |
| [ExplanationMarksPanel.jsx](../../../frontend/src/components/ExplanationMarksPanel.jsx) | `Modal size="xl" className="marks-modal"`，固定高度 `min(85vh, 760px)` |
| [MarkItem.jsx](../../../frontend/src/components/marks/MarkItem.jsx) | 引文 280 字折叠；批注是**单行** `<input>`，Enter 保存；`.marks-note` 没有 `white-space: pre-wrap` |
| [ChapterExplanationModal.jsx](../../../frontend/src/components/ChapterExplanationModal.jsx) / [ReviewReaderModal.jsx](../../../frontend/src/components/ReviewReaderModal.jsx) | 已有 `⛶ Fullscreen` 模式（`.is-fullscreen`：`100vw × 100vh`、无圆角）；Esc 先退出全屏 |
| 摘录数据 | 每条有 `prefix` / `suffix`：保存时引文前后各最多 40 字的原文（[explanationAnchor.js](../../../frontend/src/utils/explanationAnchor.js) `CONTEXT_PAD`） |
| 后端 `MarkService.normalizeNote` | 只 `trim`，**保留换行**；最长 1000 字 |

## 3. 改进 1：全局滚动条样式

### 3.1 目标

- 所有滚动区域（整页、弹窗、左右栏、编辑器、图片面板……）统一为**细滚动条、始终可见**，颜色跟随主题。
- 轨道透明，没有上下箭头；滑块为圆角胶囊。
- 不改变任何元素的布局和滚动行为。

### 3.2 方案

在 [base.css](../../../frontend/src/styles/base.css) 中加入（`:root` 的变量放在现有 `:root` 块中）：

```css
:root {
  --scrollbar-thumb: color-mix(in srgb, var(--text-secondary) 35%, transparent);
  --scrollbar-thumb-hover: color-mix(in srgb, var(--text-secondary) 60%, transparent);
}

/* 标准属性：Chrome/Edge 121+、Firefox。scrollbar-color 会继承，scrollbar-width 不会。 */
html {
  scrollbar-color: var(--scrollbar-thumb) transparent;
}
* {
  scrollbar-width: thin;
}

/* 不支持标准属性的浏览器（旧版 Safari 等）用 WebKit 伪元素兜底 */
@supports not (scrollbar-color: auto) {
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: content-box;
  }
  ::-webkit-scrollbar-thumb:hover { background-color: var(--scrollbar-thumb-hover); }
  ::-webkit-scrollbar-button { display: none; }
  ::-webkit-scrollbar-corner { background: transparent; }
}
```

要点：

- **颜色跟主题走**：用 `--text-secondary` 混透明，浅色主题是半透明棕/灰，`midnight` 深色主题自动变为浅色滑块，不需要按主题单独写。
- **必须用 `@supports not` 包住 WebKit 伪元素**：Chrome 121+ 只要设置了 `scrollbar-color` / `scrollbar-width` 就会忽略 `::-webkit-scrollbar`，两套同时生效时行为不一致；用 `@supports` 明确二选一。
- 标准属性不支持“悬停加深”，Chrome/Firefox 下滑块颜色固定；悬停加深只在兜底分支中有。这是可以接受的差异。
- `scrollbar-gutter: stable` 和 [Modal.jsx](../../../frontend/src/components/Modal.jsx) 中“打开弹窗时补偿滚动条宽度”的逻辑都基于实测宽度，滚动条变细后仍然正确，无需修改。
- 若某处已有自己的 `scrollbar-*` 样式（当前没有），以局部为准。

### 3.3 验收

- 5 个主题下分别查看：书库页、书页、Saved Passages 左右栏、讲解阅读器（含图片面板）、各表单弹窗。滚动条都是细的、无箭头、轨道透明，颜色与背景协调；`midnight` 下滑块清晰可见。
- 打开 / 关闭弹窗时背景页面不发生横向位移。

## 4. 改进 3：右栏文字被遮挡

### 4.1 根因

- `.marks-content` 是滚动容器，但右侧没有内边距：引文、“N passages”、Delete 按钮的右边缘紧贴滚动条。
- `.marks-quote` 是斜体，CJK/拉丁斜体字形向右外伸，超出行盒的部分被滚动容器（`overflow`）裁掉，于是每行最后一个字缺一角。

### 4.2 方案（[passages.css](../../../frontend/src/styles/passages.css)）

```css
.marks-content {
  padding-right: 0.75rem;      /* 与滚动条留出间隙 */
}
.marks-quote {
  padding-right: 0.25em;       /* 给斜体字形的外伸留空间 */
}
```

- 左栏 `.marks-sidebar` 已有 `padding-right: 0.5rem`，保持。
- 右栏标题行 `.marks-content-header` 是 sticky，背景会随 `.marks-content` 的内边距一起缩进，无需改。
- 窄屏（< 640px）规则不变。

### 4.3 验收

- 非最大化、最大化两种状态下，长斜体引文每行最后一个字完整；Delete 按钮右边框与滚动条之间有可见间隙。

## 5. 改进 2：对话框最大化

### 5.1 交互

- 对话框右上角、× 的左侧加一个图标按钮：
  - 非最大化：`⛶`，`aria-label="Maximize"`，`title="Maximize"`；
  - 最大化：`⤡`，`aria-label="Restore"`，`title="Restore size"`。
- 最大化 = **铺满整个窗口**：`100vw × 100vh`、无圆角无边框，与讲解阅读器的 `⛶ Fullscreen` 视觉一致。
- **记住状态**：存到 `localStorage`（键 `savedPassagesMaximized`，值 `on` / `off`），下次打开面板沿用。读写都包 `try/catch`，写法同 [useReaderPreferences.js](../../../frontend/src/components/explanation/useReaderPreferences.js)。
- **Esc 直接关闭面板**，不是“先退出最大化”。原因：阅读器的全屏是临时的沉浸状态，而这里的最大化是被记住的尺寸偏好，用 Esc 退出会悄悄改掉偏好。最大化只由按钮切换。
- 窄屏（< 640px）下不显示该按钮（弹窗本来就接近满屏）。

### 5.2 最大化时的布局

| 区域 | 非最大化（现状） | 最大化 |
| --- | --- | --- |
| 弹窗 | `max-width: 1100px; width: 95%; height: min(85vh, 760px)` | `width: 100vw; max-width: none; height: 100vh; max-height: 100vh; border-radius: 0; border: none` |
| 左栏宽度 | 260px | 300px |
| 右栏内容 | 撑满 | 内容列 `max-width: 60rem` 居中（标题行、错误提示、摘录列表一起），避免超长行难以阅读；滚动条仍在右栏最右侧 |

实现上：`.marks-content` 仍是滚动容器（撑满），在其内部加一层 `.marks-content-inner`（`max-width` 只在最大化时生效，`margin: 0 auto`）。sticky 标题行放在 `.marks-content-inner` 内即可。

### 5.3 Modal 增加头部按钮位

[Modal.jsx](../../../frontend/src/components/Modal.jsx) 新增可选 prop `headerActions`（ReactNode），与 × 一起放在右上角容器中：

```jsx
<div className="modal-corner">
  {headerActions}
  <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
</div>
```

```css
.modal-corner {
  position: absolute;
  top: 0.6rem;
  right: 0.75rem;
  z-index: 2;
  display: flex;
  gap: 0.25rem;
}
.modal-close { position: static; }   /* 定位交给 .modal-corner；尺寸、颜色、hover 不变 */
.modal-icon-btn { /* 与 .modal-close 相同的 32px 圆形透明按钮样式，字号略小 */ }
```

- 不传 `headerActions` 的弹窗外观与现在完全一致（× 的位置不变）。
- 有额外按钮时，标题需避开右上角：`.marks-modal .modal-title { margin-right: 5rem; }`。

### 5.4 验收

- 点 `⛶` 铺满窗口，点 `⤡` 恢复；关闭再打开保持上次状态；刷新页面后仍保持。
- 最大化时 × 与 `⤡` 可见、可用；Esc 关闭面板。
- 最大化时左右栏各自滚动正常，右栏内容居中且不超过 60rem。

## 6. 改进 4：单条摘录专注编辑（Focus）

### 6.1 形式：叠加在面板上的“专注弹窗”

不改变面板本身的布局（不隐藏左栏、不把列表换成单条），而是在面板**上方再打开一个弹窗**，只显示这一条摘录及其批注编辑区。关闭它就回到原来的面板和位置。

- 弹窗用 `Modal size="lg"`（880px 宽；沿用上一轮修好的“头部固定 + 内容区滚动”），面板最大化时也同样居中显示。
- 遮罩叠在面板之上（两层遮罩，背景更暗，自然形成“聚焦”效果）。

### 6.2 入口

- **点击引文**（`.marks-quote`）进入专注弹窗。
  - 引文加上可点击的提示：`cursor: pointer`，悬停时背景轻微高亮，`title="Focus on this passage"`。
  - 无障碍：引文容器 `role="button"`、`tabIndex={0}`，Enter / Space 打开，`aria-label="Focus on this passage"`。
  - **不影响复制**：若 `click` 发生时 `window.getSelection()` 非空且位于该引文内（用户在拖选文字），不打开。
  - “Show more / Show less” 仍只展开 / 折叠，不打开专注弹窗。
- **Add note / Edit note 按钮也打开专注弹窗**，并直接把光标放进批注输入框。列表中原来的单行内联编辑器移除，批注统一在专注弹窗里写（多行、空间充足）。

> 决定（可调整）：统一入口可以避免“两套批注编辑器”行为不一致（单行 vs 多行、Enter 保存 vs Enter 换行）。如果更希望保留列表内的快速单行编辑，可只保留引文点击入口，Add note 维持现状。

### 6.3 弹窗内容

```
┌───────────────────────────────────────────────────────────────┐
│ 定都长安：想长治久安，地利很重要                       ×      │  ← 标题 = 章节名（固定）
│ Passage 2 of 3 · Nov 4, 8:15 AM   ⚠ Position may have changed │  ← 副标题行（陈旧时才有 ⚠）
├───────────────────────────────────────────────────────────────┤
│ …周王室无法控制各方；洛阳缺少足够强的地理屏障；              │  ← prefix，浅色
│ ███ 3. 洛阳的问题是地势不够强 周朝强盛时：天下和睦；……      │  ← 引文全文，荧光底色
│ ███ ……洛阳四面暴露的特点就会变成风险。                       │
│ 6. 关中能够扼住天下的要害…                                   │  ← suffix，浅色
│                                                               │
│ Note                                                128 / 1000│
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ 多行输入框，自动增高                                       │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                      Saved ✓   [Save note]    │
├───────────────────────────────────────────────────────────────┤
│ [← Previous] [Next →]          [Jump to] [Delete]             │
└───────────────────────────────────────────────────────────────┘
```

**原文区**

- 引文**全文显示**，不做 280 字折叠；字号比列表大一档（约 `1.1rem`、`line-height: 1.9`），**非斜体**（长段斜体中文不易阅读），用与阅读器中已收藏高亮相同色系的浅色底色标出。
- 上下文：引文前显示 `prefix`、引文后显示 `suffix`，颜色 `--text-secondary`、略小字号；`prefix` 前加 “…”、`suffix` 后加 “…”（为空时不显示，也不加省略号）。三段放在同一个 `white-space: pre-wrap` 容器里按行内文本连续排列，就像从原文中截出的一段。
- 原文区可选中复制。

**批注区**

- 多行 `<textarea>`，始终展开；初始 4 行，随内容自动增高，最高约 `40vh`，超过后内部滚动。
- 打开时自动聚焦，光标放在已有批注末尾。
- 右上角字数 `n / 1000`（`maxLength=1000`，与现有上限一致）。
- 占位符：`Write your thoughts about this passage…`。
- **显式保存**：
  - `Save note` 按钮（内容未改动时禁用），或 `Ctrl + Enter` / `⌘ + Enter`；`Enter` 换行。
  - 保存成功：按钮旁显示 `Saved ✓`，约 2 秒后消失；保存后**留在当前弹窗**。
  - 保存失败：显示 `Could not save the note. Try again.`，草稿保留。
  - 保存内容为 `trim()` 后的文本；清空即删除批注（与后端行为一致）。

**底部操作栏**

- `← Previous` / `Next →`：在**当前章节内**按列表顺序切换，到头 / 到尾时禁用；不跨章节。焦点不在输入框时，键盘 `←` / `→` 同样生效。
- `Jump to`：关闭专注弹窗和面板，打开阅读器并定位（与列表中的 Jump to 相同）。
- `Delete`：弹出现有删除确认；删除后显示同章节的下一条，没有下一条则上一条，章节已空则关闭专注弹窗（面板按已有规则切到相邻章节）。

### 6.4 未保存保护

批注草稿与已保存内容不同（比较 `trim()` 后的值）时，以下操作先弹确认：

- Previous / Next、Jump to、Delete；
- 关闭专注弹窗（×、Esc、点遮罩）。

确认框复用 [ConfirmDialog.jsx](../../../frontend/src/components/ConfirmDialog.jsx)：`title="Unsaved note"`、`message="Discard the changes to this note?"`、`confirmLabel="Discard"`。选 Cancel 回到编辑，选 Discard 继续原操作。

（不做自动保存：批注是思考后的结论，显式保存更可控，也避免网络请求在输入过程中反复失败。）

### 6.5 Esc 与弹窗层级

- 打开专注弹窗时，面板的 `closeOnEsc` 必须为 `false`（与现在 `deleteTarget` 打开时的处理一致），否则一次 Esc 会同时关闭两层——两个 Modal 都在 `document` 上监听 Esc。
- Esc 的顺序：确认框 → 专注弹窗（有未保存草稿时先弹 §6.4 的确认）→ 面板。
- `body` 的 `overflow` 锁定：Modal 按“先进后出”恢复，叠加的弹窗按顺序卸载即可，无需修改。

### 6.6 关闭后回到列表

关闭专注弹窗后，面板右栏把**最后查看的那一条**滚动到可见（`scrollIntoView({ block: 'nearest' })`），并给它一个短暂的高亮（复用 `.mark-flash-block` 动画），用户通过 Previous / Next 走到别的条目后也不会迷失位置。

### 6.7 列表中的批注显示

批注可以多行后，[passages.css](../../../frontend/src/styles/passages.css) 的 `.marks-note` 加 `white-space: pre-wrap`，列表中按原换行显示（阅读器悬停卡片 `.mark-popover-note` 已是 `pre-wrap`）。

## 7. 组件与接口改动

### 7.1 文件

| 文件 | 改动 |
| --- | --- |
| [base.css](../../../frontend/src/styles/base.css) | §3 滚动条 |
| [Modal.jsx](../../../frontend/src/components/Modal.jsx) / [modal.css](../../../frontend/src/styles/modal.css) | `headerActions` prop、`.modal-corner`、`.modal-icon-btn` |
| [ExplanationMarksPanel.jsx](../../../frontend/src/components/ExplanationMarksPanel.jsx) | 最大化状态与按钮；`focusId` 状态；渲染专注弹窗；专注弹窗打开时 `closeOnEsc=false`；关闭后滚动 + 闪烁 |
| [MarkItem.jsx](../../../frontend/src/components/marks/MarkItem.jsx) | 引文可点击（`onFocus(mark)`）；Add/Edit note 改为 `onFocus(mark, { editNote: true })`；移除内联编辑器及 `editing` / `onEditStart` / `onEditEnd` / `onSaveNote` props |
| 新增 `components/marks/PassageFocusDialog.jsx` | 专注弹窗 |
| 新增 `components/marks/useSavedPassagesMaximized.js`（或并入面板） | `localStorage` 读写 |
| [passages.css](../../../frontend/src/styles/passages.css) | §4 内边距、最大化布局、`.marks-content-inner`、可点击引文、专注弹窗样式、`.marks-note` 换行 |

### 7.2 `PassageFocusDialog` props

```js
PassageFocusDialog({
  marks,          // 当前章节的摘录（按列表顺序），来自面板的 groups，保存后自动是最新数据
  markId,         // 当前显示的摘录 id
  chapterTitle,
  staleIds,
  onNavigate,     // (id) => void，Previous / Next / 删除后切换
  onSaveNote,     // (mark, note) => Promise，即面板现有的 onUpdateNote 包装
  onJump,         // (mark) => void
  onDelete,       // (mark) => Promise，面板负责确认框与实际删除
  onClose,        // () => void
})
```

- 草稿状态放在弹窗内部，以 `markId` 为 `key` 重新挂载即可在切换条目时重置（切换前的未保存保护在弹窗内部完成）。
- `markId` 对应的摘录不存在（被删除）时由面板按 §6.3 规则改 `focusId` 或关闭。

### 7.3 面板状态

```js
const [maximized, setMaximized] = useSavedPassagesMaximized();
const [focus, setFocus] = useState(null);      // { id, editNote } | null
const lastFocusedRef = useRef(null);           // §6.6
```

- 切换章节时关闭专注弹窗（实际只能在弹窗关闭后切章，正常不会出现，仅作防御）。
- 原有 `editingId` 状态随内联编辑器一起移除；`closeOnEsc` 改为 `!deleteTarget && !focus`。

## 8. 测试

**组件测试（Vitest + Testing Library）**

- `Modal`：传入 `headerActions` 时渲染在 × 之前；不传时结构与现在一致。
- `ExplanationMarksPanel`：
  - 点 Maximize 后弹窗带 `is-maximized` class、`localStorage` 为 `on`；再次打开组件保持最大化；点 Restore 恢复并写 `off`；
  - Esc 在最大化时直接关闭面板；
  - 点击引文打开专注弹窗；引文内存在选区时点击不打开；Enter 键可打开；
  - Add note / Edit note 打开专注弹窗且输入框获得焦点；
  - 专注弹窗打开时按 Esc 只关闭专注弹窗，面板仍在；
  - 关闭专注弹窗后最后查看的条目滚动到可见。
- `PassageFocusDialog`：
  - 显示 `prefix` / 引文全文 / `suffix`，空上下文不显示省略号；
  - `Save note` 未修改时禁用；Ctrl+Enter 保存、显示 `Saved ✓`；保存失败显示错误并保留草稿；
  - Previous / Next 在首尾禁用；有未保存草稿时切换 / 关闭 / Jump to 弹出 “Unsaved note” 确认，Cancel 留下、Discard 继续；
  - 删除后切到下一条 / 上一条 / 章节空时关闭；
  - 焦点不在输入框时 ← / → 切换。
- 改写 [ExplanationMarksPanel.test.jsx](../../../frontend/src/components/ExplanationMarksPanel.test.jsx) 中依赖内联编辑器的用例（`drops an unsaved note draft when the chapter changes`、`jumps to a passage and saves a note`、`shows an error and keeps editing when the note cannot be saved`），改为通过专注弹窗完成。

**手工验证**

- §3.3、§4.3、§5.4 的验收项。
- 写一段多行批注，保存后：列表中按行显示；在阅读器中悬停该高亮，卡片中同样按行显示。
- 专注弹窗中拖选原文可以正常复制。

## 9. 未来可选（本次不做）

| 改进 | 说明 |
| --- | --- |
| 跨章节 Previous / Next | 章末继续进入下一章，可连续逐条整理整本书的批注 |
| 专注弹窗中显示更长上下文 | 现在只有保存时记录的前后 40 字；可按需请求讲解正文，截取更长的段落 |
| Markdown 批注 | 批注支持简单的 Markdown（加粗、列表） |
| 自动保存草稿 | 未保存的草稿暂存到 `sessionStorage`，误关后可恢复 |
| 滚动条悬停加深（Chrome/Firefox） | 标准属性不支持 `:hover`，需要时可用“滚动容器 `:hover` 时改 `scrollbar-color`”实现 |

## 10. 决策记录

| # | 问题 | 决定 |
| --- | --- | --- |
| 1 | 滚动条风格 | 细、始终可见、颜色跟随主题 |
| 2 | 滚动条范围 | 全局（整页 + 所有内部滚动区） |
| 3 | 最大化尺寸 | 铺满窗口，与阅读器 Fullscreen 一致 |
| 4 | 是否记住最大化 | 记住（`localStorage`） |
| 5 | Esc 与最大化 | Esc 直接关闭面板，不先退出最大化 |
| 6 | 专注编辑的形式 | 叠加在面板上的独立弹窗，面板保持不变 |
| 7 | 专注入口 | 点击引文；Add / Edit note 也进入（可调整，见 §6.2） |
| 8 | 专注模式导航 | 仅当前章节内 Previous / Next |
| 9 | 批注保存 | 显式保存（按钮 / Ctrl+Enter），离开前未保存提示 |
| 10 | 上下文 | 浅色显示 `prefix` / `suffix` |
