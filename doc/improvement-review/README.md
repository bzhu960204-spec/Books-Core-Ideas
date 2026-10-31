# 项目改进评审（Improvement Review）

> 评审日期：2026-10-31 ｜ 范围：后端、数据库、前端、安全、工程实践 ｜ 状态：**待逐项改进**
>
> 本目录用于记录 Books-Core-Ideas 的全面评审结果，并作为后续"一步步改进"的**任务清单与进度追踪**。
> 每完成一项，就在下方追踪表中更新状态，并在对应条目下补充"已完成：做了什么 / 提交号"。

## 文档结构

| 文件 | 内容 |
|---|---|
| [01-verified-bugs.md](01-verified-bugs.md) | 已实测复现 / 代码确认的缺陷（BUG-xx） |
| [02-backend-architecture.md](02-backend-architecture.md) | 后端架构与代码质量（BE-xx） |
| [03-database-and-data-safety.md](03-database-and-data-safety.md) | 数据库 schema、外键、备份与数据安全（DB-xx） |
| [04-frontend.md](04-frontend.md) | 前端结构、数据获取、性能、体验（FE-xx） |
| [05-security.md](05-security.md) | 安全（SEC-xx） |
| [06-engineering-practices.md](06-engineering-practices.md) | 测试、CI、仓库卫生、文档、脚本（ENG-xx） |

## 评审方法

- 通读后端全部源码、迁移脚本、配置与启动脚本；前端核心页面与组件（重点是大文件与数据流）。
- 运行 `npm run lint`（31 errors / 3 warnings）与 `npm run build`（单 chunk 1.19MB）。
- 在**临时目录的独立 H2 库**上启动后端（端口 18080，未触碰 `backend/data` 真实数据），用 HTTP 请求复现可疑问题。标记为"✅ 实测"的条目均已复现。

## 总体评价

**做得好的地方**（改进时应保留）：
- 功能完整且贴合个人阅读工作流：书 → Part → 章 → 想法/摘录/讲解/标记/书签，配合书单、书评库、阅读历史。
- 代码注释质量高，大量"为什么这样做"的说明；已有多份功能设计文档。
- 迁移导入有不错的防护意识：单书事务、提交后再写图片、zip bomb 上限、路径穿越校验。
- 开发/生产两套一键脚本，prod 单端口模式与端口自动回退做得细致。

**主要问题**集中在四类：
1. **可恢复性**：空库无法启动、迁移归档不完整、（原先）没有备份手段。
2. **数据完整性**：删除级联缺失（删书/删章 500）、子资源无归属校验。
3. **可维护性**：无测试、无 CI、超大组件、API 风格不一、实体直出。
4. **性能与体验**：列表接口返回整库内容、详情页 N+1 请求、1.2MB 单包、错误静默吞掉。

## 推荐改进路线

> 原则：**先止血、再建安全网、后重构**。每阶段的改动都先有测试兜底再动手。

### 阶段 0 · 止血（数据安全 + 致命缺陷）
| 顺序 | ID | 事项 |
|---|---|---|
| 0.1 | DB-05 | ✅ 手动备份/恢复脚本（大的重构前执行 `backup-data.ps1`） |
| 0.2 | BUG-01 / DB-01(短期) | ✅ 空库可启动 |
| 0.3 | BUG-02 / BUG-03 / BUG-08 | ✅ 删除级联：书评、章节图片（含文件）、书单成员 |
| 0.4 | BUG-04 | ✅ CORS 加 PATCH + Vite 代理 |
| 0.5 | ENG-03 / FE-06 | ✅ 清理入库的 `node_modules`，jszip 归位 |

### 阶段 1 · 安全网
| 顺序 | ID | 事项 |
|---|---|---|
| 1.1 | ENG-01 | 后端集成测试骨架 + 阶段 0 的回归测试 |
| 1.2 | ENG-02 | ✅ GitHub Actions CI |
| 1.3 | FE-02 | ESLint 清零 |
| 1.4 | BE-04 / BUG-07 | ✅ 全局异常处理（ProblemDetail） |
| 1.5 | BUG-05 | ✅ 子资源归属校验 |

### 阶段 2 · 后端结构与数据
| 顺序 | ID | 事项 |
|---|---|---|
| 2.1 | BE-02 | `GET /api/books` 瘦身 + 引入 DTO |
| 2.2 | BE-01 / BE-06 | Service 层、ImageStorageService、统一导出逻辑 |
| 2.3 | DB-01 / DB-02 | Flyway 成为唯一 schema 来源，补外键与级联，`ddl-auto=validate` |
| 2.4 | BE-08 | 迁移归档 v2：补齐书评/书签/标记/书单 |
| 2.5 | BE-05 / BE-03 | 校验、枚举、API 风格统一 |

### 阶段 3 · 前端
| 顺序 | ID | 事项 |
|---|---|---|
| 3.1 | SEC-01 | ✅ DOMPurify 清洗富文本 |
| 3.2 | FE-03 / FE-08 / BUG-06 | 聚合接口 + 数据层（TanStack Query）+ 后端 JSON 导入 |
| 3.3 | FE-01 | 拆分 BookDetailPage / RichTextEditor / index.css |
| 3.4 | FE-04 | 路由与重组件懒加载 |
| 3.5 | FE-05 | Toast、ErrorBoundary、404 |

### 阶段 4 · 加固与收尾
SEC-02、SEC-03、SEC-05、BE-07、BE-09、BE-10（升级 Spring Boot）、DB-04、DB-06、ENG-04、ENG-05、ENG-06、FE-07、BUG-09、BUG-10。

## 进度追踪

状态：⬜ 待办 ｜ 🔄 进行中 ｜ ✅ 完成 ｜ ⏸ 暂缓 ｜ ❌ 不做

| ID | 优先级 | 标题 | 阶段 | 状态 | 备注 |
|---|---|---|---|---|---|
| BUG-01 | P0 | 空库无法启动 | 0 | ✅ | V0 基线脚本 + 迁移测试；已在真实库副本验证 |
| BUG-02 | P0 | 删除带书评的书 500 | 0 | ✅ | Book.reviews 级联 + BookService |
| BUG-03 | P0 | 删除带图片的章节 500 / 图片不清理 | 0 | ✅ | Chapter.images 级联 + 提交后删文件 |
| BUG-04 | P1 | CORS 缺 PATCH | 0 | ✅ | 补 PATCH + Vite 代理同源 + CorsConfigTest |
| BUG-05 | P1 | 子资源归属校验 | 1 | ✅ | 404/400 + ParentOwnershipTest |
| BUG-06 | P1 | 书库导入丢 excerpts | 3 | ⬜ | |
| BUG-07 | P2 | 404/400 被当成 500 | 1 | ✅ | 随 BE-04 |
| BUG-08 | P2 | 删书后书单成员残留 | 0 | ✅ | 删书时同事务清除成员行 |
| BUG-09 | P3 | POST 带 id 500 | 4 | ⬜ | |
| BUG-10 | P3 | 图片上传序号/吞异常 | 4 | ⬜ | |
| BE-01 | P1 | Service 层 | 2 | ⬜ | |
| BE-02 | P1 | 实体直出 / 列表接口过重 | 2 | ⬜ | |
| BE-03 | P2 | API 风格统一 | 2 | ⬜ | |
| BE-04 | P1 | 全局异常处理 | 1 | ✅ | ProblemDetail + 前端解析 detail |
| BE-05 | P2 | 校验与枚举 | 2 | ⬜ | |
| BE-06 | P2 | 重复代码 | 2 | ⬜ | |
| BE-07 | P2 | 导入整包入内存 | 4 | ⬜ | |
| BE-08 | P1 | 迁移归档不完整 | 2 | ⬜ | |
| BE-09 | P3 | 配置分环境 | 4 | ⬜ | |
| BE-10 | P2 | 升级 Spring Boot | 4 | ⬜ | |
| DB-01 | P0 | Schema 双源管理 | 0/2 | 🔄 | 短期止血完成（V0）；生产切 validate 待阶段 2 |
| DB-02 | P1 | 外键与级联 | 2 | ⬜ | |
| DB-03 | P3 | 删除 migrate.sql | 0 | ✅ | |
| DB-04 | P2 | 内联 base64 图片 | 4 | ⬜ | |
| DB-05 | P2 | 备份机制 | 0 | ✅ | 按需求缩小为手动 backup/restore 脚本，不做自动备份 |
| DB-06 | P3 | 建模细节 | 4 | ⬜ | |
| FE-01 | P1 | 拆分超大组件/样式 | 3 | ⬜ | |
| FE-02 | P1 | ESLint 清零 | 1 | ⬜ | |
| FE-03 | P1 | 数据获取 N+1 / 缓存 | 3 | ⬜ | |
| FE-04 | P2 | 代码分割 | 3 | ⬜ | |
| FE-05 | P2 | 错误处理与反馈 | 3 | ⬜ | |
| FE-06 | P1 | jszip 依赖归位 | 0 | ✅ | |
| FE-07 | P3 | api.js 样板 / 类型 | 4 | ⬜ | |
| FE-08 | P2 | JSON 导入移到后端 | 3 | ⬜ | |
| SEC-01 | P1 | 富文本 XSS 清洗 | 3 | ✅ | DOMPurify：粘贴入口 + 显示出口 + 导出；真实数据零差异 |
| SEC-02 | P2 | 图片类型白名单 | 4 | ⬜ | |
| SEC-03 | P1 | 仅监听本机 / 关 H2 Console | 4 | ⬜ | 若在公司网络使用，建议提前 |
| SEC-04 | P3 | 导入边界校验 | 4 | ⬜ | |
| SEC-05 | P2 | 依赖漏洞扫描 | 4 | 🔄 | 已升级 TipTap/ProseMirror/router，prod audit 0 漏洞；Dependabot 待开启 |
| ENG-01 | P0 | 测试 | 1 | 🔄 | 后端 28 个 + 前端 Vitest 6 个；每个修复附回归测试 |
| ENG-02 | P1 | CI | 1 | ✅ | GitHub Actions；lint 暂不阻断（待 FE-02）；推送后确认首次运行 |
| ENG-03 | P1 | 仓库卫生 | 0 | ✅ | node_modules 清理完成；提交信息规范持续执行 |
| ENG-04 | P2 | 构建可复现 | 4 | ⬜ | |
| ENG-05 | P2 | 文档更新 | 4 | ⬜ | 每阶段顺带更新相关文档 |
| ENG-06 | P3 | 脚本小问题 | 4 | ⬜ | |
