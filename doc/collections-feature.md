# Collections 功能技术文档

> 书籍收藏（Collections）模块：用类似文件系统的**嵌套文件夹**组织书籍，支持多级目录、拖拽归档、一书多藏，以及按文件夹（可含子文件夹）聚合查看书籍。

## 1. 功能概述

Collections 让用户把书库里的书按自定义的树状文件夹分类管理，典型场景：

- 按主题 / 作者 / 阅读计划建立多级文件夹
- 把一本书同时归入多个收藏（多对多，非独占）
- 拖拽整理：把书拖进文件夹、把文件夹拖到另一个文件夹下重新归属
- 聚合查看：选中某个文件夹时，可选择「包含子文件夹的书」一并展示

与 `Book` 上的自由文本 `category` 字段**相互独立**：`category` 是单一标签，Collections 是可嵌套、可多归属的结构化组织方式。

涉及的数据实体：`BookCollection`（文件夹，靠 `parentId` 形成树）与 `BookCollectionItem`（文件夹↔书的多对多关联行）。

## 2. 整体架构

```
前端
  Sidebar「🗂️ Collections」→ CollectionsPage → CollectionsExplorer  (主界面)
  LibraryPage「🗂️ Collect」按钮 → AddToCollectionModal              (快速归藏)
        │  (bookCollectionApi)
        ▼
BookCollectionController  (/api/book-collections/*)
        │
        ▼
BookCollectionService  ← 树形 CRUD、成员管理、环路校验、聚合查询
        │
        ▼
BookCollectionRepository / BookCollectionItemRepository
        │
        ▼
BOOK_COLLECTIONS / BOOK_COLLECTION_ITEMS  (表)
```

## 3. 数据模型

### 3.1 实体

**`BookCollection`**（[BookCollection.java](../backend/src/main/java/com/bookscoreideas/entity/BookCollection.java)）— 文件夹节点
- `id`
- `parentId`：父文件夹 id，`null` 表示根级文件夹，由此形成树
- `name`：名称（非空，≤200 字）
- `sortOrder`：同级排序，默认 0
- `createdAt` / `updatedAt`：由 `@PrePersist` / `@PreUpdate` 维护

**`BookCollectionItem`**（[BookCollectionItem.java](../backend/src/main/java/com/bookscoreideas/entity/BookCollectionItem.java)）— 文件夹与书的关联行
- `collectionId` + `bookId` 组成唯一约束（同一本书不会在同一文件夹里重复）
- `addedAt`

### 3.2 表结构（迁移 V5）

见 [V5__add_book_collections.sql](../backend/src/main/resources/db/migration/V5__add_book_collections.sql)。采用 `IF NOT EXISTS` 幂等写法，兼容 Hibernate `ddl-auto=update` 已建表的情况：

- `BOOK_COLLECTIONS(ID, PARENT_ID, NAME, SORT_ORDER, CREATED_AT, UPDATED_AT)`
- `BOOK_COLLECTION_ITEMS(ID, COLLECTION_ID, BOOK_ID, ADDED_AT)`
  - 唯一约束 `UK_BOOK_COLLECTION_ITEMS(COLLECTION_ID, BOOK_ID)`
  - 索引 `IDX_BCI_COLLECTION_ID`、`IDX_BCI_BOOK_ID`

## 4. 后端 API

基础路径 `/api/book-collections`（[BookCollectionController.java](../backend/src/main/java/com/bookscoreideas/controller/BookCollectionController.java)）。

| 方法 & 路径 | 说明 |
| --- | --- |
| `GET /` | 列出所有文件夹（扁平，按 `sortOrder`、`name` 排序），每项带 `bookCount` 直属成员数 |
| `POST /` | 新建文件夹，body: `{ name, parentId?, sortOrder? }` |
| `PUT /{id}` | 仅更新 `name` / `sortOrder`（**不含**改父，见下） |
| `PUT /{id}/move` | 改父（重新归属），body: `{ parentId }`，`null` 表示移到根级 |
| `DELETE /{id}` | 删除文件夹及其所有子孙文件夹（书本身不删，仅解除归属） |
| `GET /{id}/books?includeDescendants=bool` | 取某文件夹的书；`true` 时聚合所有子孙文件夹并去重 |
| `GET /for-book/{bookId}` | 某本书直属归入的文件夹 id 列表 |
| `POST /{id}/books/{bookId}` | 把书加入文件夹（已存在则幂等跳过） |
| `DELETE /{id}/books/{bookId}` | 把书移出文件夹 |

返回体 `BookCollectionResponse`（[BookCollectionResponse.java](../backend/src/main/java/com/bookscoreideas/dto/BookCollectionResponse.java)）：`id, parentId, name, sortOrder, bookCount, createdAt, updatedAt`。

## 5. 后端业务逻辑要点

实现于 [BookCollectionService.java](../backend/src/main/java/com/bookscoreideas/service/BookCollectionService.java)。

- **更新与改父分离**：`update()` 只改名/排序；改父单独走 `move()`。因为请求体里「缺省 parentId」与「显式 null」无法区分，若合并会把重命名的文件夹误移到根级。
- **环路防护**：`move()` 禁止把文件夹设为自身父级，或移动到自己的子孙之下（通过 `descendantIds()` BFS 计算子孙集合判断）。
- **级联删除**：`delete()` 收集自身 + 全部子孙 id，先删关联行再删文件夹；不删书。
- **聚合查询**：`booksIn(id, includeDescendants)` 用 `LinkedHashSet` 保持插入顺序并跨多个文件夹去重。
- **成员计数健壮性**：`directMemberCounts()` 与 `collectionIdsForBook()` 会过滤掉书已被删除、但关联行仍残留的「孤儿」记录，避免角标虚高。
- **名称清洗**：`sanitizeName()` 去空白、禁空、限 200 字。
- 类与写操作均标注 `@Transactional`，读操作标注 `@Transactional(readOnly = true)`。

## 6. 前端结构

API 封装：[api.js](../frontend/src/api.js) 的 `bookCollectionApi`（`list / create / rename / move / remove / booksIn / collectionsForBook / addBook / removeBook`）。

### 6.1 CollectionsExplorer（主界面）

[CollectionsExplorer.jsx](../frontend/src/components/collections/CollectionsExplorer.jsx) —— 左树 + 右内容两栏布局：

- **左侧文件夹树**：新建根文件夹、展开/折叠、选中。
- **右侧内容区**：
  - 顶部**面包屑**：显示当前文件夹的完整路径；路径过深（>4 级）时折叠为 `根 / … / 父 / 当前`，`…` 可点击弹出下拉跳转到被隐藏的祖先；路径区始终单行不换行，`+ Add books` 按钮固定在右侧。
  - 「Include books from sub-folders」开关：切换是否聚合子文件夹的书。
  - 书籍列表：紧凑横向卡片（封面/首字母占位、标题、作者、评分、章节数），点击进入书详情（带 `from: 'collections'` 状态以便返回），每行可「Remove」移出当前文件夹。
- **文件夹增删改**：新建/重命名用同一个弹窗（`dialog` 状态区分 `create-root` / `create-child` / `rename`）；删除前 `confirm` 提示会连带删除子文件夹。

### 6.2 CollectionTree（文件夹树 + 拖拽）

[CollectionTree.jsx](../frontend/src/components/collections/CollectionTree.jsx) —— 递归渲染 `FolderRow`，核心是**拖放（DnD）**：

三种 dataTransfer 类型：
- `BOOK_DND_TYPE`：拖拽书卡到文件夹
- `BOOK_SOURCE_DND_TYPE`：随书携带其来源文件夹 id，使「拖到另一文件夹」语义为**移动**而非复制
- `FOLDER_DND_TYPE`：拖拽文件夹到另一文件夹下重新归属

拖拽规则与细节：
- 文件夹不能拖到自身或自己的子孙上（`blockedIds` 用子树 id 集合拦截）。
- 「⤴ Move to top level」放置区：仅当拖动的是非根文件夹时才出现，用于移回根级。该区域**渲染在列表之后**——若在 dragstart 时插到列表顶部会把所有行下移、导致浏览器取消拖拽。
- 每个文件夹行带直属成员数角标（`bookCount > 0` 时显示）。

### 6.3 PickBooksModal（批量加书）

[PickBooksModal.jsx](../frontend/src/components/collections/PickBooksModal.jsx) —— 从全量书库挑书加入当前文件夹：
- 左栏按**作者**过滤（含「Unknown author」哨兵、作者搜索、计数角标）。
- 右栏按标题/作者关键字搜索，复选多选。
- 已在该文件夹里的书显示「Added」且禁选。
- 确认时并发 `addBook` 批量提交。

### 6.4 AddToCollectionModal（单书快速归藏）

[AddToCollectionModal.jsx](../frontend/src/components/collections/AddToCollectionModal.jsx) —— 从书库页（[LibraryPage.jsx](../frontend/src/pages/LibraryPage.jsx) 的「🗂️ Collect」按钮）打开：
- 把文件夹树扁平化并带缩进展示，复选即时切换该书在各文件夹的归属（勾选调 `addBook`、取消调 `removeBook`）。
- 底部可直接「Create & add」新建根文件夹并立刻把当前书加入。

## 7. 关键设计约定

- **书与收藏是多对多、非独占**：一本书可同时在多个文件夹；从文件夹移出或删除文件夹都**不删除书**。
- **category 与 Collections 并存且独立**：前者是单标签，后者是可嵌套多归属结构。
- **幂等性**：加书、建表均为幂等操作，重复调用安全。
- **顺序与去重**：聚合查看按插入顺序保留、跨文件夹去重。
- **响应式面包屑**：深层路径折叠 + `…` 下拉，保证低分辨率/长路径下布局不破。
