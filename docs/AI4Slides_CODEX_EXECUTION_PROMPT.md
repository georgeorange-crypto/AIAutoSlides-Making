# Codex 执行指令：AI4Slides Tool Matrix + Workflow V2

请在仓库 `https://github.com/georgeorange-crypto/AIAutoSlides-Making` 中**真实执行**完整的多工具集成架构迁移。首先阅读我提供的 `AI4Slides_Tool_Matrix_Workflow_Architecture_v2.md`（建议放在仓库 `docs/ARCHITECTURE_V2.md`），以及现有 `README.md`、`AGENTS.md`、`package.json`、所有源码/Schema/测试和先前的 `PROJECT_CAPABILITIES_QA.md`。

## 我的明确目标

不是选择一个最佳的 PPT 生成器，也不是让你从头重写一个“AI PPT SaaS”。**我要的是可广泛接入优秀开源项目、可配置商业 API、能够自动组合工具的 Tool Matrix + Workflow + Agent Harness。**

每个有用的候选工具都应该进入注册表，并在相应阶段真正通过 Adapter 使用；不应因工具功能重叠而提前排除。没有必要在每次任务运行全部工具，但所有已集成能力都应按需可调用。

不要只做产品选型评测、计划或 README：必须实现代码、运行 fixture、测试、报告真实进度。

## 强制阅读和落实的工具生态

- **解析**：Docling、Microsoft MarkItDown、PyMuPDF、Pandoc、python-pptx；网站经授权使用 Playwright。
- **叙事**：OpenAI Responses、其他可选模型 provider、本地 deterministic planner；产物有 Evidence Ledger、Storyboard、Speaker Notes。
- **模板/完整生成**：Presenton REST/MCP、自托管；slide-maker Skill；PPT Master Skill；PPTAgent Skill/CLI。
- **独立生成后端**：现有 PptxGenJS、Quarto、Slidev、Marp。
- **图表**：PptxGenJS native chart、Matplotlib、Plotly、Vega-Lite、Apache ECharts。
- **架构图**：Mermaid、Graphviz、D2、PlantUML、draw.io 导出/文件格式。
- **视觉素材**：Wikimedia Commons、Unsplash/Pexels（按 API/许可）、Lucide、Iconify、Simple Icons、Sharp、resvg、可选图像模型。
- **现有 PPTX 继续编辑**：pptx-automizer、python-pptx、PowerPoint Office.js（宿主相关）。
- **商业/协作服务**：Canva REST APIs/MCP、Gamma API、Beautiful.ai API、Google Slides API；分离 OAuth/密钥/用户许可。
- **渲染与审稿**：LibreOffice、Windows PowerPoint/COM、Playwright、OOXML 分析、visual critic、事实和许可审查。

## 必须先解决的两个工程现实

1. 核对远端 `main`、现有工作分支与 Q&A 描述是否一致。不能把文件里自述的实现当作已通过测试。旧命令继续兼容，旧数据/证据不得丢失。
2. 不能直接把多个完整引擎的内部依赖塞入一个 Node/npm 进程，也不能承诺所有跨后端 PPTX 都无损合并。Node/TypeScript 作为编排主进程，Python 工具和大服务以隔离环境运行，SaaS 作为可选 Service Adapter。

## 第一轮必须交付的可运行工作

A. `registry/catalog`：登记上述所有工具，字段包括官方链接、许可证审查状态、版本、接口、平台、功能、输入输出、依赖、联网/认证/费用、可编辑性及实际验证状态。明确区分 `catalogued`、`adapter-ready`、`smoke-tested`、`e2e-tested`。

B. 实现可扩展的 ToolAdapter 协议与 `ai4slides tools list`、`ai4slides tools doctor`、`ai4slides tools test <id>`；所有没有安装、认证、或权限的工具应报可解释的 blocked 状态，不能导致默认构建失败。

C. 实现 Source/Evidence IR、Presentation IR、Run Manifest 三套版本化 Schema，包括 `slide_id`、`element_id`、来源定位、素材授权、数据转换、讲稿、输出格式/编辑性、运行日志和产物 hash。实现兼容旧 storyboard/evidence 的迁移层。

D. 在现有 PptxGenJS 外包适配器，保留旧 `npm run check`。然后真实接入本地 Docling、MarkItDown、Mermaid 或 D2、Matplotlib、LibreOffice，并构建至少一条 `paper.pdf + results.csv → 概要/证据 → figures → 可编辑 PPTX → PDF/逐页 PNG → QA` 端到端工作流。禁止假设 demo 数据是真实实验结果。

E. 实现最小的本地模板/素材注册表与 pptx-automizer workflow：导入既有 PPTX，在可行情况下只替换指定页上的文字/图表，输出新的 PPTX 与 before/after 预览；未编辑页不应发生未报告变化。

F. 至少为 `research`、`pitch`、`modify-existing`、`technical-html`、`update-data-deck`、`multiengine` 创建正式 Workflow Spec，并解释具体工具路由、输入输出与失败回退。

## 接下来的集成轮次

- **Agent round**：slide-maker、PPT Master、PPTAgent、Presenton 做独立真实 smoke/E2E。研究其实际调用方式，不要拿到 README 就宣称已集成；PPTAgent 当前 Skill 明确“宿主 Agent 创作”，不允许在 Codex 内无限生成作者 Agent。PPT Master 的 Service backend 有未完成阶段，要以能够真实运行的 Skill/CLI 为先。
- **HTML/research round**：Quarto、Slidev、Marp 分别跑真实导出；对 PPTX 可编辑性做对象级检查，不能因为扩展名是 PPTX 就宣布编辑性达标。
- **SaaS round**：Canva、Gamma、Beautiful.ai、Google Slides，完成真实 service adapter、认证配置、权限检查、可运行的无密钥 mock contract tests。只有拿到真实账户及明确授权，才做线上 E2E，且须记录费用。
- **QA/repair round**：逐页图像审稿、图表数字比对、版权/许可元数据检查、字体可用性、编辑性占比、带 slide/element ID 的增量重做、精确的费用和延迟报告。

## 验收和防止“纸面集成”

每个工具一份 manifest + doctor + runnable example + fixture + test + provenance log；每个 workflow 都生成真实 artifact。结果区分 `tested`/`partially tested`/`not tested`/`blocked`。提交完整命令、日志、截图、PDF/PPTX、编辑对象检查、成本、已知风险、在 Windows 和 Linux 的差异。

禁止在无授权情况下上传保密论文、数据或素材到外部服务；禁止付费 API 意外调用、复制未经授权的模板资产、虚构数值/引用、静默栅格化 PPTX、覆盖原稿、泄露 token。默认 local-only、零 API 成本、有限重试、缓存和资源隔离。

## 交付文件

- `docs/ARCHITECTURE_V2.md`
- `docs/TOOL_MATRIX.md`
- `docs/WORKFLOW_SPECS.md`
- `docs/INTEGRATION_STATUS.md`
- `docs/QA_RUBRIC.md`
- `docs/DEPENDENCY_LICENSES.md`
- `registry/catalog/*.yaml`
- `packages/contracts/*`, `packages/adapters/*`, `packages/orchestrator/*`
- `tests/*`, `fixtures/*`
- README、AGENTS.md、CI 更新、真实演示成品

**执行方法**：先完成审计与 P0，再完成能够运行的 P1 纵向切片，并尽量继续 P2。每阶段实际运行、逐页检查并保存证据后才能进入下一步。不要仅输出计划；超出单次实现能力就提交已验证的代码和清晰的剩余工作清单，保持主线可运行。
