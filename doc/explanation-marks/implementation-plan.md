# 讲解片段收藏 —— 分阶段实现计划

> 配套设计见 [design.md](./design.md)。每个阶段都可**独立交付、独立验证**，后一阶段依赖前一阶段。

---

## Phase 1 —— 后端数据与接口（可独立联调）

**目标**：片段能被创建、按书查询、改批注、删除。

1. 新增实体 `entity/ExplanationMark.java`（字段见 design §4.1，风格对齐 `ReadingBookmark`）。
2. `entity/Chapter.java` 增加 `@OneToMany` 的 `explanationMarks`（cascade=ALL, orphanRemoval, `@JsonIgnore`）。
3. 新增迁移 `resources/db/migration/V7__add_explanation_marks.sql`（design §4.2，`IF NOT EXISTS` 幂等）。
4. 新增 `repository/ExplanationMarkRepository.java`（含按书 / 按章排序查询方法）。
5. 新增 `controller/ExplanationMarkController.java`：
   - `POST /api/chapters/{chapterId}/marks`
   - `GET /api/books/{bookId}/marks`
   - `PATCH /api/marks/{id}`
   - `DELETE /api/marks/{id}`

**验收**：
- 应用启动、迁移成功（已有 `ddl-auto=update` 环境也不报错）。
- 用 curl/Postman 走通四个接口；删章 / 删书后片段被级联清除。

---

## Phase 2 —— 讲解内收藏片段（前端采集）

**目标**：在讲解查看态选中文字即可收藏。

1. 新增 `src/utils/explanationAnchor.js`：
   - `getPlainTextOffsets(rootEl, range)` → `{ startOffset, endOffset }`
   - `buildQuoteContext(rootEl, startOffset, endOffset, pad=40)` → `{ prefix, quote, suffix }`
   - 空白归一化辅助。
2. `src/api.js` 新增 `markApi`（design §6.1）。
3. `ChapterExplanationModal.jsx`：
   - 查看态监听选区，浮出"📑 收藏此片段"工具条（可选批注输入）。
   - 采集锚点并回调 `onSaveMark`。
   - 保存后给瞬时"✓ 已收藏"反馈。
4. `BookDetailPage.jsx`：实现 `onSaveMark`（调 `markApi.create`，更新本地计数/列表）。
5. `index.css`：收藏工具条样式。

**验收**：
- 选中讲解中一段文字可成功收藏，后端查到该记录，`quote/prefix/suffix/offset` 合理。

---

## Phase 3 —— 本书"片段收藏"入口与跳转定位（前端查看）

**目标**：书内查看全部片段并点击回跳定位。

1. `BookDetailPage.jsx`：加载 `markApi.listByBook`，头部加入口按钮 **"📑 片段收藏 (N)"** + 面板开关状态。
2. 新增 `src/components/ExplanationMarksPanel.jsx`：按章节分组列表，支持「跳转 / 编辑批注 / 删除」，含空态。
3. `ChapterExplanationModal.jsx`：新增 `initialAnchor` prop，渲染后定位 + 临时闪烁（design §6.3），未命中按 `startOffset` 兜底。
4. `BookDetailPage.jsx`：点击跳转时复用 deep-link，向 Modal 传 `initialAnchor`。
5. `index.css`：`.mark-flash` 闪烁动画。

**验收**：
- 面板按章分组正确展示；点击任一片段打开对应讲解并滚动闪烁到正确段落。
- 编辑批注 / 删除即时生效；删除后计数更新。
- 讲解被改写后跳转不报错，退回就近定位并提示"位置可能已变"。

---

## Phase 4（可选）—— 章节角标与打磨

1. 章节行"有收藏片段"小角标（对齐现有 explanation / bookmark 角标）。
2. 列表片段长文本展开/收起、时间格式化、键盘可达性与无障碍标签。
3. 收藏工具条在滚动 / 失焦时的消失逻辑打磨。

**验收**：角标与现有风格一致；交互细节无明显瑕疵。

---

## 测试与回归要点

- 迁移幂等：全新库与已有 `ddl-auto` 库都能干净应用。
- 级联删除：删章 / 删书不留孤儿片段。
- 定位鲁棒性：正文含重复句子、被编辑、超长片段等场景。
- 不污染原文：收藏与跳转全程不改 `ChapterExplanation.content`。
