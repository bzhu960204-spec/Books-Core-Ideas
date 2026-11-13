# 文档索引

> 2026-11-01 随 ENG-05 建立。项目简介、启动方式、备份与测试命令见根目录的 [README.md](../README.md)（英文）。

## 开发约定（改代码之前先读）

| 文档 | 内容 |
|---|---|
| [development-workflow.md](development-workflow.md) | 工作约定：数据安全、配置 profile、迁移、测试要求、在真实数据副本上验证、前端新旧版本并排对比、提交规范、Windows PowerShell 5.1 备忘 |
| [api-conventions.md](api-conventions.md) | 接口约定：状态码、错误格式（ProblemDetail）、请求体校验与长度上限、日期与枚举的写法 |
| [database-schema-and-flyway.md](database-schema-and-flyway.md) | 数据库结构由 Flyway 管理：迁移脚本一览、外键删除规则、命名约定、新增迁移的步骤、防回归测试、排错 |

## 功能说明

| 文档 | 内容 |
|---|---|
| [json-import-format.md](json-import-format.md) | JSON 导入格式（英文）：书库、章节 / Part、想法、摘录、单章导入 |
| [migration-feature.md](migration-feature.md) | 迁移（ZIP 导出 / 导入）：归档格式 v2、导入流程、安全措施 |
| [collections-feature.md](collections-feature.md) | 书单（嵌套文件夹）：数据模型、接口、前端组件 |
| [explanation-marks/implementation.md](explanation-marks/implementation.md) | 讲解片段收藏的实现说明：交互、接口、锚点算法、踩过的坑 |
| [explanation-outline/implementation.md](explanation-outline/implementation.md) | 章节讲解阅读器的大纲：悬浮面板、当前位置高亮、不改正文 DOM 的跳转方式 |
| [malformed-link-fix.md](malformed-link-fix.md) | 富文本编辑器中畸形 Markdown 链接的识别与修复 |

## 历史记录

这些文档记录当时的设计和过程，不随代码更新，现状以上面两组文档和代码为准。

| 文档 | 内容 |
|---|---|
| [explanation-marks/design.md](explanation-marks/design.md)、[implementation-plan.md](explanation-marks/implementation-plan.md) | 讲解片段收藏的设计稿和分阶段计划。与最终实现的差异见 implementation.md 第 2 节 |
| [improvement-review/](improvement-review/README.md) | 2026-10-31 的全面评审，以及之后逐项改进的记录：每项的问题、做法、测试与验证结果、设计决策的理由，以及进度表 |
