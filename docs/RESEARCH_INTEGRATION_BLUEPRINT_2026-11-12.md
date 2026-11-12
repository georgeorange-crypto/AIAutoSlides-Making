# AIAutoSlides-Making：产品化、开源生态与多引擎系统方案

日期：2026-11-12
版本：研究与架构建议 v1（**选型建议，不代表已经集成、安装或通过运行测试**）

## 0. 需求来源与边界

以用户《PRODUCTIZATION_AND_DESIGN_QA.md》为依据，覆盖：(Q1) Windows/Android App；(Q2) Codex/Claude/其他 AI 的 MCP/API/Skill；(Q3) 内容筛选、叙事、媒介、审美、演讲时长；(Q4) 个性化偏好与多角度问答；(Q5) 联网研究、文档解析、素材归类与证据关联。叠加之前明确提出的“尽量广泛集成优秀工具、必须有工具矩阵与工作流”。

现有公开仓库：https://github.com/georgeorange-crypto/AIAutoSlides-Making 。核对 GitHub `main` 的 README 和 package.json 后，公开版本仍标注 MVP 0.1.0，Node.js + PptxGenJS；与上传 QA 中描述的 M3/M4 本地进展可能并非同一代码版本。升级前必须取得 Codex 工作区的实际 commit、工作树和测试结果；不能把 QA 中的功能视为已在公开分支验证。

## 1. 可复用项目（官网/源码与应用场景）

| 分类 | 项目 | 许可（已核实/需核实） | 复用方式 | 优先级 | 主要风险 |
|---|---|---|---|---|---|
| 完整 AI 生成平台 | [Presenton](https://github.com/presenton/presenton) | Apache-2.0 | Windows Electron、Web UI、模板、PPTX、MCP/API；先独立运行，再经 API 适配 | P0 | 前后端耦合、升级时 API 改动、原生编辑保真 |
| 研究 Agent | [PPTAgent / DeepPresenter](https://github.com/icip-cas/PPTAgent) | MIT | 研究 agent+视觉迭代，最新版 Skill；旧论文复现用固定标签 | P0 | Linux/WSL 依赖、模型与渲染开销、版本演化 |
| Agent Skill | [slide-maker](https://github.com/addsumtech/slides_maker) | MIT | Skill 方式调 Codex，保留脚本与可编辑成果 | P0 | Agent 宿主依赖、Skill 与平台工具衔接 |
| 自由式视觉设计 | [SlidePoise](https://github.com/henryhyw/slidepoise) | MIT | 设计探索 + native 元素重建；优先做质量对照 | P0/P1 | 图像重建保真、复杂依赖与字体 |
| 辅助 UI 参考 | [AIPPT](https://github.com/LRriver/AIPPT) | Apache-2.0 | 逐页确认、局部修改设计参考 | P1 | 规模/维护活跃度低，editable 未必全原生 |
| 原生 PPTX | [PptxGenJS](https://github.com/gitbrent/PptxGenJS) | MIT | 保留旧有 builder，生成原生 shape/chart/text | P0 | 排版能力与视觉效果需扩展 |
| Python PPTX | [python-pptx](https://github.com/scanny/python-pptx) | MIT | 解析、修改、检测 PPTX 结构 | P1 | 不覆盖 Office 所有特性 |
| 文档解析 | [Docling](https://github.com/docling-project/docling) | MIT（模型独立） | 文档结构、OCR、图表与图片、页码 | P0 | 重型依赖、扫描件误识别 |
| 复杂 PDF | [MinerU](https://github.com/opendatalab/MinerU) | 自定义附加条件许可证 | 专门的 PDF/科研文档解析后端 | P0/P1 | 必须专项许可证审查；资源需求 |
| 轻量转换 | [MarkItDown](https://github.com/microsoft/markitdown) | MIT | DOCX/PPTX/表格等快速转 Markdown | P0 | 页面布局定位需补充 |
| 文档推理检索 | [PageIndex](https://github.com/VectifyAI/PageIndex) | MIT | 长报告树式结构检索及引用定位 | P1 | 消耗模型推理成本、复杂性 |
| 网页抓取 | [Crawl4AI](https://github.com/unclecode/crawl4ai) | Apache-2.0 | 本地浏览器/爬取/Markdown | P0/P1 | 网站访问授权、反爬、恶意内容 |
| 商业/自建网页提取 | [Firecrawl](https://github.com/firecrawl/firecrawl) | AGPL-3.0 | 独立服务或合规 API 后端 | 可选 | AGPL 和服务条款；切勿随意复制进 MIT 产品 |
| 学术检索 | [OpenAlex](https://openalex.org/)、[Crossref](https://www.crossref.org/documentation/retrieve-metadata/rest-api/)、[arXiv API](https://info.arxiv.org/help/api/index.html) | API 条款独立 | 论文发现/元数据/DOI/预印本 | P0 | 数据许可、字段完整性、限速 |
| Markdown 演示 | [Slidev](https://github.com/slidevjs/slidev)、[Quarto](https://quarto.org/) | 各项目单独核实 | 作为辅助渲染后端 | P1 | PPTX 导出未必原生可编辑 |
| 图表 | [Vega-Lite](https://vega.github.io/vega-lite/)、[Plotly](https://plotly.com/javascript/) | 各项目单独核实 | 真实数据图、SVG/PNG 中间产物 | P1 | 嵌入为 SVG 不等于 PowerPoint 原生可编辑 |
| 图示 | [Mermaid](https://mermaid.js.org/)、[D2](https://d2lang.com/)、[Graphviz](https://graphviz.org/) | 各项目单独核实 | 结构图、流程图及可重建元素 | P1 | SVG 与原生 shape 语义差异 |
| 商业后端 | [Gamma API](https://developers.gamma.app/)、[Canva](https://www.canva.dev/)、[Google Slides API](https://developers.google.com/workspace/slides/api/guides/overview) | 商业条款 | 可选 API/质量基线/远程编辑 | P2 | 账户权限、费用、私密材料出站、导出格式 |

**特别注意**：GitHub 许可证只是初筛。每个子模块、模型权重、字体、媒体素材、依赖包还有独立许可与商业使用限制。tldraw SDK 为 source-available 且有商业授权约束，不当作 MIT 依赖。

## 2. 核心产品策略：工具生态全纳入，运行时只选适合的

把工具分类为：discoverable（已登记但未安装）、installed（安装通过）、configured（密钥/依赖齐全）、validated（通过测试）、enabled（当前项目可用）、deprecated（禁用）。

产品不等于“每个工具都在每次任务中运行”。应保留所有优质候选工具的注册信息，按能力、预算、授权、隐私、平台、输出格式、可编辑性、时延和健康状况路由。用户可强制指定工具；失败必须可解释并降级。

每个 Adapter 定义：`id/version/kind/capabilities/platforms/inputs/outputs/privacy/locality/price/terms/health/timeout/can_edit/can_native_charts`，实现 `probe()`、`run(task, workspace)`、`collectArtifacts()`、`cancel()`。运行在独立子进程/容器中，不能在核心中复制第三方私有逻辑。

推荐优先 **独立适配模式**：把 Presenton 当独立服务/桌面基线，PPTAgent、SlidePoise、slide-maker 当额外生成后端，而非一开始就深度 fork 某个项目。只有经过 POC 明确其技术栈、接口和质量符合要求，才决定是否 fork UI。

## 3. 目标架构

```
Desktop / Web UI / Android thin client / CLI / MCP / Agent Skill
                           |
                       Application API
                           |
   Project & Profile / Consent & Policy / Job State / Version History
                           |
               Workflow Orchestrator (durable DAG)
     |          |              |             |          |
  Research   Evidence      Narrative      Visual      QA/Critic
  Engine     Graph         Planner        Planner
     |          |              |             |          |
     +----------+--------------+-------------+----------+
                           |
                Canonical SlideIR / ProjectIR
                           |
                   Tool Registry & Router
             |           |         |          |
           Presenton   PPTAgent  SlidePoise  PptxGenJS ...
                           |
                  Build → Render → Verify
                           |
                   PPTX / PDF / PNG / Notes
```

**推荐技术基线**：TypeScript 负责核心领域模型、任务 API、用户项目与 CLI；Python 微服务用于 Docling/MinerU/多模态分析；SQLite + 文件目录/内容寻址保存源素材、任务状态和历史；选定工作流状态框架前先用普通队列+状态机做单机 MVP。多任务恢复与人工审查复杂起来后可评估 LangGraph（偏 Agent）或 Temporal（偏可靠执行）。

Windows UI 不需要立即造：Presenton Electron 独立部署先给真实用户使用。未来自有 UI 可复用 React/Electron，也可评估 Tauri，但 Tauri 的 Python/Node sidecar 与 Android 移植不能自动等价。

## 4. 统一中间表示（SlideIR）

统一内容与源数据，而不是以某个渲染器的内部 JSON 当统一标准。一个页面需要：目标、受众、结论、内容单元、支持证据、证据验证状态、素材引用与版权状态、媒介候选、选择理由、布局偏好、时间预算、讲者备注、输出原生性要求与工具来源。

```json
{
  "schema_version": "1.0.0",
  "deck_id": "deck-research-001",
  "audience": {"type": "research_group", "expertise": "specialist"},
  "goal": "获得对瓶颈分析方法的反馈",
  "duration_seconds": 300,
  "slides": [{
    "id": "slide-03",
    "role": "evidence",
    "takeaway": "压缩命中恢复耗时远超未压缩基线",
    "claims": [{"id": "claim-001", "statement": "...", "evidence_ids": ["ev-011"], "review_status": "pending"}],
    "visual": {"kind": "native_chart", "data_ref": "dataset-011", "alternatives": ["table", "chart"]},
    "source_asset_ids": ["asset-013"],
    "design": {"policy": "academic-research", "layout_intent": "comparison"},
    "time_budget_seconds": 42,
    "speaker_notes": "...",
    "export": {"require_editable_text": true, "require_native_chart": true}
  }]
}
```

约束：所有真实数值只从通过核验的 dataset/source 取值；LLM 可做叙事摘要，但不能生成未经来源支撑的实验数据。UI、Agents 和引擎适配器使用同一 `slide_id`、`claim_id`，便于局部重做而非全量再生成。

## 5. Evidence Graph（证据图）与 Asset Library（素材资产库）

建议对象：Source（来源元数据+原文件 SHA256）；Chunk（文段/页/表/坐标）；Claim（可核验结论）；Dataset（表/图数值+单位/轴含义）；Asset（图片/音视频/截图+授权）；Slide（使用关系）；Review（人工核验/驳回记录）。

关系：`Chunk SUPPORTS/CONTRADICTS Claim`；`Claim APPEARS_ON Slide`；`Asset ILLUSTRATES Claim`；`Dataset RENDERS_AS Figure`。必须保留提取来源页码/段落/原文短摘、抽取模型、检索时间和核验状态。绝不把搜索结果摘要默认为事实核验。

研究链：研究问题 → 搜索候选 → 抓取并记录 → 文档解析 → 证据候选抽取 → 交叉验证/检测矛盾 → 重要性评估 → 素材使用建议 → 人工关键核验 → Slides。

## 6. 内容与视觉智能（真正自研）

1. Audience Model：听众领域背景、知识门槛、情境、目标行为、总时长与问答时间；
2. Content Candidate Builder：从 Evidence Graph 提取可讲的知识单元；
3. Narrative Planner：主题/论点的依赖 DAG，生成 2–3 种故事线并给出取舍；
4. Content Selector：在总时长、证据、前置知识和叙事完整性约束下保留关键结论；
5. Media Planner：文字/图片/图表/表格/架构示意/视频之间选择，输出解释与替代方案；
6. Time Allocator：为每页设置讲解时间与备注，不将单纯按字符计时当作实际彩排；
7. Layout Planner：输出与渲染器无关的布局意图，考虑语言扩展、字号、视觉层次；
8. Critic Ensemble：事实完整、叙事、可读性、版式、审美、可编辑性、许可和演讲时间多维评分；
9. Feedback Learner：记录用户显式评分/修改，在用户允许时更新长期偏好。

参考原则：MIT EECS Communication Lab 每页明确传达一种核心信息，图像与证据服务于标题；Y Combinator 强调可读、简单、直观；但设计政策需要按学术/商业/教学等不同用途切换。视觉审查采用 **真实渲染截图** 而非只读源 JSON（DeepPresenter 的 environment-grounded reflection 路线）。

## 7. 多工具选择算法（建议）

```
for task in workflow.tasks:
    candidates = registry.filter(capabilities, platform, enabled, healthy)
    candidates = policy.filter(privacy, outbound_permission, license, budget)
    shortlist = rank(candidates, prior_quality_by_task_type, latency, cost,
                     editable_fidelity, stability)
    if important_or_ambiguous: run_top_2_or_3_as_competing_variants()
    else: run_best_candidate_with_fallback()
    verify_output(schema, provenance, visual, editable)
    if failed: repair_locally_or_try_next_adapter()
    log(traces, decisions, metrics, costs, output_hashes)
```

切勿使用缺乏依据的固定“美观分数”直接宣布工具最佳。需要实际评测证据。

## 8. 操作系统与产品入口

- Windows P0：先部署 Presenton Desktop 与外部引擎的独立测试环境。保留现有 Node CLI；后台任务独立运行；其余能力经统一 API/MCP 暴露。
- Windows P1：根据 POC 决定 fork Presenton UI 还是自建 Electron UI。必须支持打开项目、研究过程、证据库、逐页预览、局部修改、运行记录、审查与 PPTX 导出。
- Android P2/P3：先做远程任务与预览、反馈、审批的轻客户端/PWA；有明确离线业务需求再做本机运行时，不能简单复用 Windows sidecar。
- 外部 Agent P0：MCP Server `create_project`, `import_sources`, `research_topic`, `plan_deck`, `render_deck`, `critique_deck`, `edit_slide`, `export_deck`, `get_job_status`, `list_artifacts`。读写、外联、导出、批量操作分别控制权限。

## 9. 个性化问答向导与偏好模型

Profile 分为 Global/User、Project、Session 三层，覆盖场景/受众/语言/专业深度/时间/字号/视觉风格/信息密度/图表类型/敏感内容/文件本地策略。启动时可选择“5 问快速模式”“详细访谈”“导入参考 PPTX”。支持跳过、回退、预览与覆盖，不强迫答完所有问题。

长期偏好不能通过一次选模板就推断“学会了用户审美”。需要显式评分、修改记录、已确认设计方案和解释；支持查看、导出、重置偏好。

## 10. 质量与评测

结合 [PPTAgent/PPTEval](https://aclanthology.org/2025.emnlp-main.728/)、[DeepPresenter](https://aclanthology.org/2026.findings-acl.1578/)、[SlidesGen-Bench](https://aclanthology.org/2026.emnlp-main.1482/)、[DECKBench](https://arxiv.org/abs/2602.13318)、[PresentBench](https://arxiv.org/abs/2603.07244)。

验证维度：事实支持率、未证实主张数量、故事线完整性、时间合规、文本溢出、跨系统截图一致性、原生元素可编辑率、图表与输入数据精确一致、可访问性（对比、ALT、阅读顺序）、引擎失败率、端到端成本、平均与 P95 时延、单页局部编辑保真。

建议自建 12–20 个代表性任务：学术五分钟组会/十五分钟会议/教学/咨询/投资委员会/销售/技术演讲等；至少包括中文和英文、高密度数据、公式、图片、扫描 PDF、冲突证据、时间紧约束。统一输入与预算，对各候选工具跑原始输出；人工盲评与自动判定相结合，报告分项分布与失败案例。数据源和测试集许可单独审查。

## 11. 安全、许可与成本边界

- 对私密未发表资料默认本地优先；外发模型、网页服务和第三方 SaaS 必须显示目的地、文件范围及预计费用，由用户确认。
- 用户材料、抓取网页、第三方工具配置均为不可信输入，防 prompt injection；Agent 工具仅可访问用户授权路径；容器/子进程沙箱执行；禁用任意 shell 对外暴露。
- [OWASP MCP Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/MCP_Security_Cheat_Sheet.html)：最小权限、独立凭证、工具描述审查。
- Firecrawl / SearXNG 是 AGPL；若纳入产品需合法合规设计独立服务、履行发布义务或选择更宽松的替代品。MinerU 的许可条件须单独阅读。
- 图片搜索与下载不得假设“公开网页图片即可自由用于 PPTX”。素材要带作者、来源、许可、限制；[Unsplash API 指南](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines) 有 hotlink/归属/下载上报义务；[Pexels 服务条款](https://help.pexels.com/hc/en-us/articles/900005880463-What-are-the-Terms-and-Conditions) 禁止部分批量/模型数据集用途。
- 控制 token、图片生成、OCR、爬取、外部 API 成本；设置预算上限、按阶段缓存、重复构建去重。

## 12. 可执行优先级与验收

### P0 — 仓库审计与选型 POC

- 固定工作区 commit；跑现有 `npm test/validate/build`；记录 QA 文档声称功能的实际存在与否。
- 独立安装运行 Presenton、PPTAgent skill、slide-maker、SlidePoise；使用相同的三种源资料测试。
- 输出 `docs/TOOL_MATRIX.md`、`docs/POC_RESULTS.md`、`docs/LICENSE_AUDIT.md`、截图/导出的 PPTX 文件、可编辑性审查结果。
- 未通过真实测试的插件标记 experimental，绝不声称正式支持。

### P1 — Canonical IR + Adapter + E2E

- 加 `packages/core` 中间层、`adapters/*` 和 job API；至少保留旧 PptxGenJS 并接入一个新引擎。
- 建立 PDF/DOCX 导入与 source→claim→slide 证据链。
- 端到端真实文档→研究→内容规划→渲染→QA→PPTX，附出错重试与可复现记录。

### P2 — 演示智能 + UI + MCP

- 构建 audience/narrative/media planner 与多维 Critic；开启多候选对照。
- Windows 工作台可以使用 Presenton 基线或者基于 POC fork/自建；MCP 工具要覆盖项目级管理与局部修改。
- 引入简洁问答向导和持久化偏好。

### P3 — 质量强化与移动端

- Benchmarks + 人工盲评；局部编辑稳定性；多模型/多后端成本治理；Android 远程客户端。

**完成标准**：非开发者在 Windows GUI 中输入真实论文/实验材料，系统能检索和归纳证据、解释每一页讲什么与为何选择此视觉形式；导出可编辑 PPTX 和报告；可以只修改第 3 页；Codex 从 MCP 能执行相同动作，所有结果有来源和可复现记录。

## 13. 主要资料（原始文献 / 官方文档）

- Presenton: https://github.com/presenton/presenton ，Template V2: https://github.com/presenton/presenton/blob/main/docs/template-v2.md
- PPTAgent (EMNLP 2025): https://aclanthology.org/2025.emnlp-main.728/
- DeepPresenter (ACL 2026): https://aclanthology.org/2026.findings-acl.1578/
- SlidesGen-Bench (EMNLP 2026): https://aclanthology.org/2026.emnlp-main.1482/
- DECKBench: https://arxiv.org/abs/2602.13318
- PresentBench: https://arxiv.org/abs/2603.07244
- AutoPresent/SlidesBench: https://arxiv.org/abs/2501.00912
- MIT EECS Communication Lab: https://mitcommlab.mit.edu/eecs/commkit/slideshow/
- Y Combinator Pitch Deck: https://www.ycombinator.com/library/4T-how-to-design-a-better-pitch-deck
- Google Slides API: https://developers.google.com/workspace/slides/api/guides/overview
- LangGraph: https://docs.langchain.com/oss/python/langgraph/overview
- Microsoft PPT accessibility: https://support.microsoft.com/en-us/accessibility/powerpoint/make-your-powerpoint-presentations-accessible-to-people-with-disabilities

## 14. 明确不做的事

不为了“全部集成”而在单任务调用全部引擎；不把网页搜索结果当验证事实；不将 JPG 嵌入 PPTX 称为可编辑图表；不把未知许可资源直接纳入发布版；不让 LLM 自己给自己打分后宣布质量提升；不在开发 Android 之前实现无证据的“移动端离线全功能”。
