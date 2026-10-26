# 讲解片段收藏（Explanation Marks）实现说明

> 本文记录**已落地的实现**，是 [design.md](./design.md)（原始设计）与 [implementation-plan.md](./implementation-plan.md)（分阶段计划）的落地结果与偏差说明。Phase 1–3 已完成，Phase 4（章节角标等打磨）未做。

---

## 1. 最终交互一览

阅读一章的讲解（查看态）时：

1. **选中文字** → 选区起点上方浮出小菜单：`📑 Save passage` / `✎ Note`。
2. **保存** → 该段文字变为**常驻黄色高亮**；菜单原地变成 `✓ Passage saved` + `Undo`。
3. **Undo** 撤销误存；点击页面其他位置、重新选中别处或 6 秒后，提示自动消失。
4. 书籍详情页头部 **`📑 Saved Passages (N)`** 打开面板：按章节分组，支持 `Jump to` / `Edit note` / `Delete`。
5. **Jump to** 打开对应章节并滚动到该段，出现约 2 秒的橙色闪烁。
6. 阅读底栏 **`🖍 Highlights: On/Off`** 可隐藏正文里的黄色高亮（偏好持久化，全局生效）。

> 全部 UI 文案为英文，与项目其余部分一致。

---

## 2. 与原设计的偏差

| 原设计 | 实际实现 | 原因 |
|---|---|---|
| §1.2 不做常驻内联高亮 | **做了**：已保存片段常驻高亮，可开关 | 保存后若没有持久反馈，用户无法判断是否已存；`CSS Custom Highlight API` 不改 DOM，成本很低 |
| §6.2 选区附近浮出"收藏"按钮 | 浮动菜单，但**锚在选区起点**，并跟随滚动 | 浏览器（Edge）自带选区迷你菜单出现在选区末端，锚在起点可避开重叠 |
| §7 讲解被删除时清除该章片段 | 在 `ChapterExplanationController.deleteExplanation` 中显式删除 | 片段挂在 `Chapter` 下而非 `ChapterExplanation` 下，删除讲解不会自动级联 |
| 新增 | `Undo`、重复保存检测（`✓ Already saved`）、高亮开关 | 交互完整性 |

---

## 3. 后端

### 3.1 文件

| 文件 | 说明 |
|---|---|
| `entity/ExplanationMark.java` | 实体，风格对齐 `ReadingBookmark`；`quote` 为 CLOB；`@PrePersist`/`@PreUpdate` 维护时间 |
| `entity/Chapter.java` | 增加 `explanationMarks`（`cascade=ALL, orphanRemoval, @JsonIgnore`），删章/删书级联清除 |
| `repository/ExplanationMarkRepository.java` | 按书、按章排序查询；`deleteByChapterId` |
| `controller/ExplanationMarkController.java` | 见 3.2 |
| `controller/ChapterExplanationController.java` | 删除讲解时一并删除该章片段（`@Transactional`） |
| `resources/db/migration/V7__add_explanation_marks.sql` | `IF NOT EXISTS` 幂等建表 + 索引 |

### 3.2 API

| 方法 & 路径 | 说明 | 备注 |
|---|---|---|
| `POST /api/chapters/{chapterId}/marks` | 新建片段 | `quote` 为空 → 400；章节不存在 → 404；`prefix`/`suffix` 截断到 200，`note` 截断到 1000 |
| `GET /api/books/{bookId}/marks` | 本书全部片段 | 按 章节 `orderIndex` → `startOffset` → `id` 排序 |
| `GET /api/chapters/{chapterId}/marks` | 单章片段（可选接口） | 前端目前未使用 |
| `PATCH /api/marks/{id}` | 修改批注 | 空批注视为清空 |
| `DELETE /api/marks/{id}` | 删除 | 不存在 → 404，成功 → 204 |

响应 DTO（手工 `Map`）：`id, bookId, bookTitle, chapterId, chapterTitle, chapterOrderIndex, quote, prefix, suffix, startOffset, endOffset, note, createdAt, updatedAt`。

> **迁移注意**：全新空库会在 Flyway **V2** 失败（`BOOKS` 表不存在）——这是既有行为（Flyway 先于 Hibernate 建表），与本功能无关。已有库（含 Hibernate `ddl-auto=update` 建好的表）上 V7 幂等通过。

---

## 4. 前端

### 4.1 文件

| 文件 | 说明 |
|---|---|
| `src/utils/explanationAnchor.js`（新） | 锚点采集与定位工具，见第 5 节 |
| `src/api.js` | 新增 `markApi`（`create / listByBook / updateNote / delete`） |
| `src/components/ChapterExplanationModal.jsx` | 选区检测、浮动菜单、高亮、跳转定位、高亮开关 |
| `src/components/ExplanationMarksPanel.jsx`（新） | 本书片段面板 |
| `src/pages/BookDetailPage.jsx` | 持有 `marks` 状态；入口按钮；保存/改批注/删除/跳转接线；向弹窗传入当前章节的 `marks` |
| `src/index.css` | `.mark-menu`、`.marks-*`、`::highlight(...)` 等样式 |

### 4.2 `ChapterExplanationModal` 新增 props

| prop | 说明 |
|---|---|
| `marks` | 当前章节的片段，用于画常驻高亮与重复检测 |
| `onSaveMark(mark)` | 返回保存后的片段（用于 Undo） |
| `onDeleteMark(id)` | Undo 使用 |
| `initialAnchor` | 跳转目标；渲染后滚动并闪烁 |
| `onAnchorResult({id, exact})` | 回报定位是否命中，面板据此标注 `⚠ Position may have changed` |

### 4.3 选区与菜单状态

- **选区检测**：监听 `document` 的 `selectionchange`，防抖 150ms 后读取选区。这样鼠标、键盘（Shift+方向键）、触屏、双击选词都能覆盖。
- 选区必须完整落在讲解正文内；折叠或在外部 → 清除选中状态。
- 选中状态存为 `{ anchor, range }`（`range` 为克隆）。浏览器原生选区因输入框获得焦点而丢失时，菜单仍可用。
- 菜单焦点在菜单内（备注输入框）时，忽略 `selectionchange`，避免把正在输入的状态清掉。
- **重复检测**：`marks` 中存在 `startOffset/endOffset` 完全相同的片段 → 菜单显示 `✓ Already saved`，不再创建。
- **保存后**：移除原生选区，状态进入 `savedNotice`（带 `range`，菜单锚定在刚保存的片段处）。`Undo` 调用 `onDeleteMark`。`savedNotice` 在以下情况清除：6 秒超时 / 菜单外任意 `pointerdown` / 出现新的选区 / 进入编辑态。

### 4.4 菜单定位

菜单 `position: fixed`，通过 `useLayoutEffect` + 滚动/resize 监听**直接写 `style.top/left`**（不走 state，避免每次滚动重渲染）：

- 取活动 `Range` 的第一个 client rect；默认放在其**上方**，上方放不下则放下方。
- 水平方向贴选区起点，并限制在阅读区内。
- 选区滚出阅读区可视范围时 `visibility: hidden`，滚回来恢复。

### 4.5 高亮层（CSS Custom Highlight API）

均不修改讲解 HTML，仅在运行时登记 `Range`；`highlightsSupported()` 为假时整体降级。

| 高亮名 | 用途 | 样式 |
|---|---|---|
| `mark-pending` | 当前选区（原生选区丢失时的延续），`priority=1` | 系统色 `Highlight/HighlightText`，与原生选中一致 |
| `mark-saved` | 已保存片段（常驻） | `--accent` 60% 透明黄 |
| `mark-flash` | 跳转定位的临时强调，`priority=2` | 橙色，约 2.2 秒后移除 |

- `mark-saved` 在 `marks` 变化、讲解内容变化、高亮开关切换时重建；用一份文本索引一次性定位所有片段（`findAnchorRanges`）。
- 降级：不支持 Highlight API 的浏览器，常驻高亮与高亮开关不显示；跳转闪烁退化为给最近块级元素加 `.mark-flash-block` 动画。

### 4.6 高亮开关

- 底栏 `🖍 Highlights: On/Off`，`aria-pressed`，状态存 `localStorage['explanationReaderShowHighlights']`（`on`/`off`，默认 on）。
- **关闭后**：只是不登记 `mark-saved`。选中、`mark-pending`、保存、重复检测（数据层）、Undo、跳转闪烁都不受影响。保存提示文案相应简化为 `✓ Passage saved`。

---

## 5. 锚点算法（`explanationAnchor.js`）

沿用设计文档的"双重锚点"，并明确了归一化规则。所有偏移均基于**渲染根节点归一化后的纯文本**：

1. 用 `TreeWalker` 按文档顺序拼接文本节点；
2. 连续空白折叠为一个空格；
3. 不同块级元素之间补一个空格（避免段落首尾黏连）。

保存与定位使用同一套归一化，因此结果在多次渲染间稳定。

| 函数 | 作用 |
|---|---|
| `captureAnchor(root, range, pad=40)` | 返回 `{ quote, prefix, suffix, startOffset, endOffset }`；会裁掉首尾空白；无可见文本返回 `null`。支持边界落在元素节点上的选区 |
| `findAnchor(root, anchor)` | 返回 `{ range, exact, ratio }`。先用 `prefix+quote+suffix` 匹配，多处命中取离 `startOffset` 最近的；失败则仅用 `quote`；仍失败 → `range=null`，`ratio=startOffset/总长` 用于滚动兜底 |
| `findAnchorRanges(root, anchors)` | 批量定位，共用一份文本索引，仅返回命中的 `Range` |
| `flashRange(range, ms)` | 临时强调，返回清理函数 |
| `scrollRangeIntoView(scroller, range)` | 滚动到使片段位于可视区约 1/3 处 |
| `highlightsSupported()` | 是否支持 Custom Highlight API |

---

## 6. 踩过的坑（后续改动请留意）

1. **不要让讲解 HTML 随状态重渲染。**
   `dangerouslySetInnerHTML` 在该组件每次重渲染时都会重建子 DOM，结果是：只要菜单出现/输入备注，正在拖选的选区就被清掉。
   → 已把正文抽成 `memo` 组件 `ExplanationHtml`，仅在 `html` 或 `fontScale` 变化时更新。今后往 Modal 增加状态不会再误伤选区，但**不要把会频繁变化的 prop 传给它**。
2. **输入框获得焦点会清掉浏览器原生选区。**
   → 用 `mark-pending` 高亮延续视觉；菜单内焦点期间忽略 `selectionchange`。
3. **浏览器自带选区菜单无法由网页关闭**（Edge 迷你菜单等）。
   → 菜单锚在选区起点，避开末端。用户也可在浏览器设置中关闭它。
4. **保存时自己调用 `removeAllRanges()` 会触发 `selectionchange`。**
   → "保存/Undo"提示不依赖折叠选区来清除，而是监听菜单外的 `pointerdown`，避免被自己的清除操作立刻吞掉。
5. 偏移基于渲染后的纯文本。**讲解被改写**后，偏移会漂移；此时依赖 `prefix+quote+suffix` 文本匹配，找不到则兜底滚动并提示"位置可能已变"。

---

## 7. 验证情况

**后端**（临时库 + 独立端口，未触碰真实数据）：
- Flyway 在 Hibernate 已建表的库上幂等应用 V7；
- 四个接口、400/404/204 等状态码、排序正确；
- 删除讲解 / 章节 / 书后，片段均被清除，无外键错误。

**前端**（临时测试页 + 模拟拖选，未触碰真实数据）：
- 拖选中途出现菜单不再丢选区；
- Note 流程中选中延续显示；
- 保存 → 黄色高亮 → Undo 移除；重复选同一段显示 `Already saved`；
- 菜单随滚动移动、滚出隐藏、滚回恢复；
- 高亮开关切换与 `localStorage` 持久化；
- 保存后点击别处 / 选中别处，提示立即消失；
- 锚点工具在 jsdom 下验证：跨段落、重复文本消歧、元素边界、内容被改后降级。

> 构建通过；`eslint` 中 `react-hooks/set-state-in-effect` 的报错为项目既有问题（如 `ChapterExplanationModal` 中同步 `setDraft` 的 effect），本功能未新增 lint 问题。

---

## 8. 未做 / 可选后续

- **Phase 4**：章节行"有收藏片段"角标；面板中时间格式与无障碍细节进一步打磨。
- 点击正文中已高亮的片段，直接弹出"编辑批注 / 删除"（目前需到 Saved Passages 面板操作）。
- 迁移导出/导入（`MigrationService`）尚未包含片段数据。
- 跨书的"片段 Bank"、高亮颜色/标签（设计文档的"不做"项，保持不变）。
- 为 `explanationAnchor.js` 补单元测试（目前仅做了 jsdom 手工验证）。
