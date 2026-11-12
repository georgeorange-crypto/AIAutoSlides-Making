# AIAutoSlides 项目能力问答

**整理日期：** 2026-11-12  
**用途：** 汇总本轮关于项目现状和后续能力的问答，作为项目使用说明与迭代参考。  
**范围：** 结论依据当前仓库的 README、源码、Schema、项目设计文档和配置文件。项目会继续变化；“已实现”以代码为准，“计划/建议”不代表当前已经可用。

## 如何理解本文件中的状态

- **已实现**：仓库中有对应代码或明确的本地配置，并能按文档使用。
- **部分支持**：有基础组件或受限路径，但不构成完整的端到端产品功能。
- **未实现**：文档可能提及或路线图可能规划，但当前代码没有该功能。
- **建议方向**：可作为下一阶段设计，不是现有承诺。

## Q1. 现在可以导出 PPT 或 PDF 吗？

**答：可以导出可编辑 PPTX；PDF 通过本地演示软件从 PPTX 渲染。**

- `npm run build` 使用 PptxGenJS 生成 PPTX，输出到 `outputs/research-demo.pptx`。
- `npm run preview` 调用 Windows PowerPoint COM 或 LibreOffice 将 PPTX 转为 PDF，并使用 Poppler 将 PDF 页面转为 PNG 预览。
- PDF 导出依赖本机安装的 PowerPoint 或 LibreOffice；PNG 预览还依赖 `pdftoppm`。脚本只证明完成了转换，不会自动证明页面没有裁切或视觉问题。
- PPTX 中的文本、形状和支持的图表是可编辑对象。PDF 是便于阅读和分发的渲染结果，不等同于可编辑源稿。

参考：`package.json` 中的 `build`、`preview` 脚本；`src/render.mjs`；`scripts/preview.mjs`；`README.md` 的 Quick start 和 Local rendering 章节。

## Q2. 现在能用 HTML 写网页幻灯片再导出 PPT 吗？

**答：当前没有 HTML → PPTX 的集成流程。**

现有生成路径以结构化 JSON 分镜为主，也支持受控 Markdown 大纲和 CSV 图表数据导入。HTML/网页幻灯片，以及 Slidev、Quarto、Marp 等路线在文档里作为后续评估对象或参考资料出现，但没有作为当前输出后端接入。网页转 PPT 的保真度和对象可编辑性需要单独试验，不能默认等同于原生 PPTX。

参考：`src/cli.mjs`、`src/import-markdown.mjs`、`src/import-csv.mjs`；`docs/CODEX_MASTER_PROMPT.md` 的 Multi-backend 路线；`docs/REFERENCES.md` 的工具资料。

## Q3. 项目现在会根据数据或系统架构绘制 figure 吗？有专业绘图工具吗？

**答：除原生数据图表与流程页外，现已支持受限 schema 的原生可编辑架构图；任意架构的自动布局仍未实现。**

当前支持的图表包括柱状图、折线图、散点图和经验累积分布图（CDF），并有多系列数据路径。图表由 PptxGenJS 生成 PowerPoint 原生图表对象，图表数据和转换信息可以写入来源清单。CSV 数据转换强调确定性：图表数值来自输入数据，而不是由 AI 补写。

`architecture` slide 从分组、节点、标签和方向边 JSON 生成原生 PowerPoint 形状、文本与连接线，并校验 ID、端点和页面范围。它不是任意架构导入器，也不会自动优化复杂布局。受限 `table` slide 使用原生 PowerPoint 单元格并在 evidence manifest 中保留数据和来源；支持范围为 2–6 列、1–10 行。SVG 可作为可追溯图片嵌入，但 SVG 内容仍是单一图片对象。十页 synthetic AI Systems 示例在 `examples/multimodal/`；源和指标明确标为 hypothetical/verified:false。PowerPoint 16.0 与 Poppler 已输出 PDF 和逐页 PNG；视觉检查完成，正式人工签核仍待审核者逐页记录。

参考：`src/import-csv.mjs`、`src/render.mjs`、`src/statistics.mjs`、`docs/M2_FIGURE_CORE_REPORT.md`、`docs/CODEX_MASTER_PROMPT.md` 的 `plots/`、`layouts/` 和 Visual Assets 设计。

## Q4. 项目现在能自主设计整套 PPT，并参考机构建议吗？

**答：已有受众感知的分镜草稿、规则化 Slide Critic、人工审核门和主题预览选择；完整的自主设计仍未实现。**

当前具有三套主题配置（`academic-light`、`tech-dark`、`keynote-minimal`），并支持 assertion–evidence、双栏对比、指标重点、图表加结论等复用布局。部分建议还体现在对比度检查、图表标签/单位、来源引用和长文案警告中。

M3 已加入受众/目标/时长字段、可选 AI 分镜、按规则 ID 和页面字段给出修改意见的 Critic、经人工审核且绑定内容哈希的构建门，以及三主题缩略预览和人工确认主题流程。Critic 是确定性规则辅助，不具备完整的审美判断；AI 草稿需要人工审批。

这不代表系统能自动理解所有机构规范、可靠判断哪些材料不重要、自动选出最佳讲述媒介、为所有项目生成多套最优风格，或替代人工视觉审核。不同来源建议有适用范围，不把创业路演建议强加给科研报告，也不把单一机构建议称为普遍定律。

参考：`themes/*.json`、`src/validate.mjs`、`src/contrast.mjs`、`src/render.mjs`、`docs/RESEARCH_APPLICATION_MATRIX.md`。

## Q5. 有自主撰写文案和生成逐页解说的能力吗？

**答：有受限的可选 AI 分镜草稿能力；讲者备注可写入 PPTX，但 AI 规划器目前不生成逐页讲稿。**

- 可选 `npm run plan:ai` 将本地 brief 与证据台账发送到 OpenAI Responses API，并生成受 JSON Schema 约束的标题和正文草稿。
- 规划提示约束 AI 不得编造数字、统计显著性、引用或基准结果。规划器仅允许 cover、statement、bullets、closing 等基本页面类型；图表和指标需要人工从经过审核的数据中补入。
- 该流程需要配置 API 密钥，可能产生费用。私密材料不能未经授权上传。生成文案是待人工核验的草稿，不代表事实已验证。
- Storyboard Schema 支持 `speaker_notes`，PPTX 渲染器可以将其写入演讲者备注；Markdown 导入也能保留该字段。但当前 AI 规划器的输出 Schema 不含 `speaker_notes`，因此要人工补写，才能得到逐页解说。若完整讲稿已写入备注，Critic 可依据用户提供的 WPM 和时间窗估算时长；这是算术检查，不是彩排或语速识别。

参考：`src/ai-plan.mjs`、`src/render.mjs`、`src/import-markdown.mjs`、`docs/SCHEMA.md` 的 AI storyboard 和 `speaker_notes` 说明、`docs/CONFIGURATION.md` 的 API 说明。

## Q6. 能自主搜索网页、下载/截取图片或从用户文件提取图片并插入 Slides 吗？

**答：已有本地图片素材清单和嵌入的首个切片；网页检索、截图采集和 PDF/DOCX 内嵌图片抽取仍未接入。**

`src/assets.mjs` 和 `--assets` 支持本地 PNG/JPEG/SVG 清单校验及 PPTX 图片对象嵌入，记录 SHA-256、来源、许可、核验状态和关联 slide ID；`examples/multimodal/` 有 hypothetical SVG 演示。素材仍是单个图片对象，SVG 路径不会自动转为原生可编辑形状。尚无网页搜索/下载、网页截图、授权语义验证或 PDF/DOCX 内嵌图片提取。本地 PDF/DOCX 文字提取仍不处理图片或扫描件 OCR。

任何未来检索或提取功能都应保留来源 URL/文件定位、授权或许可信息、采集日期和人工审核状态；外部页面与用户文件应作为不可信材料处理，不能当成指令或未经核验的事实。

参考：`src/qa.mjs`、`docs/SCHEMA.md`、`docs/CODEX_MASTER_PROMPT.md` 的输入适配器与来源追溯要求。

## Q7. 有提供给 AI 的 API、Harness，或者可作为 Codex/Claude Code 工作区的工具、Skill、MCP 吗？

**答：有基础规划 API 和项目工作区说明；没有通用 MCP Server、可安装 Skill 或 Claude Code 专用配置。**

- `src/ai-plan.mjs` 提供的是可选 OpenAI Responses API 分镜调用，不是面向外部 Agent 的通用 PPT 生成 API。
- 输入校验、来源 ID 校验、PPTX 构建、Slide Critic、人工审核门、QA、测试及追溯报告构成了基础执行与检查链条，可以供 Codex 在工作区中使用；但没有统一工具协议和多步骤 Agent 调度器。
- 仓库提供 `AGENTS.md`、README、Schema 和 npm 命令，Codex 可直接按项目指令操作代码和生成器。Claude Code 可读取一般项目文件，但仓库没有 `CLAUDE.md`、Skill 包或 MCP 配置。
- CI 工作流会运行构建/检查并上传示例产物；它是自动验证流水线，不是交互式制作 Agent。

参考：`AGENTS.md`、`package.json`、`src/ai-plan.mjs`、`.github/workflows/`、`docs/CONFIGURATION.md`。

## Q8. 各机构的 PPT 指导意见有保存在本地吗？

**答：有来源索引、应用矩阵，以及一份本地中文摘要指南。**

- `docs/REFERENCES.md` 保存机构/作者与公开来源链接。
- `docs/RESEARCH_APPLICATION_MATRIX.md` 记录部分原则与代码实现、限制之间的映射。
- `docs/LOCAL_SLIDE_GUIDANCE.md` 按科研报告、可访问性、商业决策演示和叙事视觉等类别整理成便于离线阅读的中文原则与检查清单。

本地保存的是链接和提炼后的简短原则，不是所有来源文件的完整副本。指南不构成机构背书；会议投稿要核对目标会议当年的官方要求。

## Q9. 项目保存了常用模板吗？

**答：保存了基础主题和版式配置，没有完整的学校、会议或公司品牌模板库。**

主题 JSON 位于 `themes/`。版式由代码中的布局实现；样例分镜在 `examples/`。这些配置可复用，但并非 `.potx` 模板，也没有收录或复制第三方机构的品牌模板、字体、图片或整套幻灯片。

参考：`themes/`、`src/render.mjs`、`docs/SCHEMA.md` 的 Styling 部分、`docs/REFERENCES.md` 的许可说明。

## Q10. 集成了市面上的 Slides 制作产品或项目吗？

**答：集成了 PptxGenJS 作为底层 PPTX 生成库；没有接入 Gamma、Canva、Slidev 等完整制作产品。**

- **PptxGenJS**：当前实际使用，负责生成原生可编辑 PPTX 对象。
- **PowerPoint/LibreOffice**：可用于本地预览渲染或 PDF 导出。
- **OpenAI Responses API**：可选文案分镜接口，不是 Slides 产品。
- **Quarto、Slidev、Marp、Frontend Slides、Gamma、Canva、Beautiful.ai、Figma Slides、Google Slides、Napkin AI**：文档中作为参考、潜在比较对象或未来适配方向出现，目前没有相应集成。

参考：`package.json`、`scripts/preview.mjs`、`docs/REFERENCES.md`、`docs/RESEARCH_APPLICATION_MATRIX.md`。

## Q11. 给半成品 Slides、详细设计方案或一个 idea，项目能否继续制作？

**答：可以继续推进，但输入适配能力不同；通常需要 Codex 在工作区协助整理材料。**

- **半成品 PPTX**：当前没有从任意既有 PPTX 导入后逐页编辑的专用适配器。可由 Codex 检查/提取内容，再转成受支持的分镜结构，或修改源码和模板；这不是一键导入编辑流程。
- **详细设计方案**：若整理成 JSON 分镜，或符合受控 Markdown 语法，可由项目生成 PPTX。CSV 可用于受支持的数据图表；PDF/DOCX 可本地提取文字和定位信息，作为待核验证据。复杂图、图片或媒体素材目前仍需人工准备。
- **只有一个 idea**：可以先写成 brief，再由 Codex 协助；可选 AI 分镜 API 也能基于 brief 和证据台账生成草稿。仅有 idea 而没有事实来源时，不能把推测写成已验证研究结论。

参考：`src/import-markdown.mjs`、`src/import-csv.mjs`、`src/ai-plan.mjs`、`docs/SCHEMA.md`。

## Q12. 项目能把图片、文案、音频、视频等素材分类管理，并给出使用意见吗？文件命名有什么规范？

**答：有图片素材清单和单图嵌入能力；尚无通用多媒体素材库、自动分类或自动使用建议。**

- **已有组织方式**：分镜可以有稳定 `slide_id`（建议 `S01`、`S02`）；事实来源用证据 ID（如 `E1`），证据台账可记录 `label`、`source`、`locator`、`verified` 和 `note`；CSV 工作流还要求明确列名，实验审计会使用稳定 `run_id`、时间戳和 `observation_id`。
- **已支持**：本地 PNG/JPEG/SVG 清单、SHA-256、来源/许可文本、verified 状态、素材—页面关联和图片对象嵌入。`verified:false` 仍表示未人工核验；许可字段不会自动判定法律授权。`r`n- **没有的能力**：音频/视频导入与预览、自动内容提取/分类，以及根据内容/授权/叙事位置提出可靠使用建议。
- **现有命名要求**：代码对 slide ID、证据 ID 和特定 CSV 字段有约定；没有对任意素材文件制定统一命名规则。
- **目录与清单**：仓库提供 `assets/` 作为本地素材目录，并在示例中采用路径相对于 manifest 的结构化清单，记录 `asset_id`、文件路径、媒体类型、来源/采集日期、作者或许可、内容摘要、建议用途、关联 slide、核验状态。建议文件名使用稳定、易读的项目/内容/版本标识，不以文件名代替来源和许可元数据。

图片素材清单和嵌入能力已部分实现；自动使用建议仍是未来方向。使用意见应由 AI 结合实际素材内容、演示目标、来源和许可字段给出，并标注不确定性；仅凭文件名不能可靠判断内容或授权。

参考：`docs/SCHEMA.md`、`sources/evidence.json`、`src/run-audit.mjs`、`src/import-repeated.mjs`。

## 综合判断与建议迭代顺序

当前项目是一个**证据可追溯、离线优先的结构化 PPTX 生成器与开发工作区**，不是全自动多模态 PPT Agent。M3A 已完成本地图片溯源与嵌入、原生架构图、10 页 synthetic 示例、机器 QA 和可渲染逐页审查流程；正式的人类逐页签核仍由审核者完成。原生表格页已实现受限结构化输入与证据清单，代码片段页和自动版式选择仍未实现。通用 CLI/API、Codex/Claude Code Skill 或 MCP 应在这些主要内容版式补齐并通过真实产物验证后评估。

## Q13. 能否在 PPTX 中生成可编辑表格？

**答：可以生成原生可编辑 PowerPoint 表格，并把表格数据和来源写入证据清单。**

`type:"table"` 接收 2–6 个表头、1–10 行数据，单元格接受有限长度字符串或有限数值；每行列数必须与表头一致，且必须引用证据 ID。PPTX 使用 PowerPoint 表格单元格对象，不是截图或 SVG。QA 检查原生表格数量、页面位置和单元格文本是否与分镜一致。当前不支持跨页自动拆表、合并单元格或自动从任意文件提取并设计表格。

参考：`src/validate.mjs`、`src/render.mjs`、`src/qa.mjs`、`src/cli.mjs`、`docs/SCHEMA.md`。


