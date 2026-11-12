# Codex 工作指令：AIAutoSlides-Making 生态复用与产品架构重构

角色：AI Systems 研究工程师 + TypeScript/Python 工程负责人 + PPTX 产品设计负责人。请在真实仓库中执行，不要只给方案。以 README、AGENTS.md、上传的 PRODUCTIZATION_AND_DESIGN_QA.md 和 `RESEARCH_INTEGRATION_BLUEPRINT_2026-11-12.md` 为依据。若本文件不在仓库中，请先复制到 docs/。

## 第一原则

1. 先审计当前实际工作树与公开 main 的差异：记录 branch、commit、uncommitted changes、功能现状、测试命令与结果；保留用户修改，不做破坏性重构。
2. 尽量复用现成优秀开源项目；不为了展示代码量重复发明 App、PPTX 布局引擎、文档解析器、MCP Server 或 AI Agent。
3. “全面纳入优秀工具生态”指注册发现、适配、评估、按需路由，不是每个任务同时运行所有引擎。
4. 绝不能声称不存在的能力已实现；外部模型/API 若无法调用需明确标注未测试并提供模拟可运行路径。
5. 科研数据不得编造；所有数值、图表、论点和外部素材记录出处与验证状态；私密研究资料不得未经允许上传外部 API。

## Phase 0：baseline + 竞争方案 POC（本轮必须优先完成）

A. 读取工作树和文档，执行原有单元测试、schema 验证、PPTX build 和截图预览；生成 `docs/BASELINE_AUDIT.md`。比较上传 Q&A 的功能声明与代码实现，将每条需求标成 verified/partial/missing/blocked。

B. 深入研究并实际运行四个核心候选：
- https://github.com/presenton/presenton （优先完整产品基线、Electron、API、MCP、PPTX）
- https://github.com/icip-cas/PPTAgent （当前 Skill 与 DeepPresenter 稳定标签要分开评估；Windows 以 WSL/容器为候选）
- https://github.com/addsumtech/slides_maker
- https://github.com/henryhyw/slidepoise

C. 三组统一测试输入：
- 学术 5 分钟：论文/实验报告+原始数值+严格来源；
- 商业 10 分钟：市场/项目汇报+指标表格+风险；
- 视觉 6 页：同一文稿+参考 PPTX+用户风格要求。

D. 生成结果必须包含：每个引擎安装步骤、平台限制、实际启动日志、版本/SHA、使用模型与成本、主要截图、PPTX 文件、页数、是否能原生编辑文字/形状/图表、失败案例、应用依赖、API/CLI/Skill 接口、许可义务、是否能增量改某页。

E. 产出 `docs/TOOL_MATRIX.md`、`docs/POC_RESULTS.md`、`docs/LICENSE_AUDIT.md`。如果外部模型密钥、网络或 Docker 不具备，说明 BLOCKED，留下可以重跑的脚本；不要虚构 benchmark 分数。

## Phase 1：定义中间表示与 Adapter 接口

先独立设计 `docs/ARCHITECTURE.md`、`docs/SLIDE_IR_SCHEMA.md`、`docs/ADAPTER_CONTRACT.md`、`docs/SECURITY_MODEL.md`。推荐 TypeScript 核心、Python 文档/AI 分析 sidecar。必须保留旧 CLI 可执行且测试通过。

最小实现：
- `packages/core` 包含 Project、UserProfile、Source、Evidence、Asset、Claim、SlideIR、DeckIR、JobState；JSON Schema 与迁移版本。
- `packages/adapters` 包含 PptxGenJSAdapter 和至少一个已运行成功的新引擎；新增适配器以 manifest 注册和动态探针检测。
- `packages/workflow` 具有导入→研究/证据→内容规划→视觉规划→生成→渲染截图→Critic→导出状态与日志。
- `packages/api` 提供项目、job、artifacts、slides 和 edit 的 REST 接口；外部 Agent 能读状态和获取产物。
- 单机 SQLite 保存项目元数据/任务状态，原始文件以 SHA256 命名，保留源文件且不覆盖。

最小接口：`probe`, `capabilities`, `render(deckIR)`, `edit(slidePatch)`, `export`, `cancel`；工具运行中要指定沙箱工作目录、超时、预算、输出 schema、日志、可编辑性能力描述。

## Phase 2：研究/文档/素材

优先 Docling + MarkItDown；MinerU 作为可选后端，先完成附加许可审核；Crawl4AI 网页抓取、OpenAlex/Crossref/arXiv 论文查询；检索和下载行为分离。所有外部服务及图片许可均可禁用；保存证据页码、引用短摘、URL、文件哈希、核验状态。批量媒体抓取必须遵守站点条款。

## Phase 3：Presentation Intelligence + Critic

实现模块与可测试契约：Audience Model、Content Candidate、Narrative Planner、Content Selector、Media Planner、Time Allocator、Render Router、Critic。让每页具有一句 takeaway、evidence refs、媒介候选与选择理由、时间预算。测试同一材料面对 research_group / investment_committee 应生成不同故事线。

Critic 必须基于真实渲染图片+PowerPoint XML；区分事实准确、图片/字体溢出、可编辑性、整体一致性、讲稿时间、来源及许可。对关键数据绘图做值一致性检查。允许仅重新生成指定页面；其他页面 hash 不应改变（除明确的跨页主题修改）。

## Phase 4：App + MCP + QA

第一阶段不自研 Android 全功能。Windows 优先用 Presenton Electron 作实际用户基线；独立 API 可以连接我们的工作流。只有在完成 POC 后才决定 fork Presenton UI 或搭建自家 React/Electron UI。MCP Server 工具应包含 `create_project/import_sources/research_topic/plan_deck/render_deck/critique_deck/edit_slide/export_deck/get_job_status/list_artifacts`，授权目录和出站 API 权限独立。

Windows 应支持个人偏好、多个项目、文件导入、研究来源列表、逐页预览、候选引擎比较、局部改稿、生成历史和真实导出。Android 后期先只做远程查看、批注、审批。

## 交付要求

每阶段必须：
- 真正提交可运行代码和 lockfile；新增测试、示例和文档；保持原有 CLI 兼容。
- 运行单元测试、集成测试、真实源文件生成与 PDF/PNG 渲染检查；列出所有命令、exit code、通过/失败明细。
- 对选型说明为什么复用某项目；对于不适配或因许可不能复用的能力，写出具体自研设计而不含糊。
- 以可复现的 artifact folder 保存 evidence ledger、输入、输出、截图、审查报告、模型和成本记录。
- 输出最后一份 `docs/IMPLEMENTATION_STATUS.md`，严格区分 implemented / tested / demo-only / blocked / planned。

**本轮优先完成 Phase 0，不准跳过评测直接大重构。** 在实际结果支持后再推进 Phase 1。遇到需要用户密钥、管理员权限或外部上传时停在授权边界，记录阻塞，不绕过安全检查。
