# Agent 项目熟悉、工作流与验收手册

本手册是新接手 agent 的执行入口。目标不是让 agent 背完仓库，而是让它能证明自己理解当前任务会触及的产品边界、工具和验收证据。`AGENTS.md` 的安全、科学诚信和 Git 要求始终优先。

## 1. 熟悉项目：按顺序阅读

每个新任务开始时，先读：

1. [`../AGENTS.md`](../AGENTS.md)：不可违反的项目规则和基本交付门槛。
2. [`../README.md`](../README.md)：安装、用户工作流、生成物和已知限制；不要把 README 中示例数据误认为真实研究结果。
3. [`CODEX_TASK.md`](CODEX_TASK.md)：当前任务背景。它可能是历史任务说明；将其与用户本轮目标、当前代码和测试结果核对，不要盲目照搬过时阶段命令。
4. [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) 与 [`INTEGRATION_STATUS.md`](INTEGRATION_STATUS.md)：当前实现和集成状态；对关键能力用源码/CLI核实，状态文档不是运行证据。
5. 与任务直接相关的契约：数据格式读 [`SCHEMA.md`](SCHEMA.md)、[`SLIDE_IR_SCHEMA.md`](SLIDE_IR_SCHEMA.md)；渲染后端读 [`ADAPTER_CONTRACT.md`](ADAPTER_CONTRACT.md)；工作流/API读 [`API_WORKFLOW.md`](API_WORKFLOW.md)、[`WORKFLOW_SPECS.md`](WORKFLOW_SPECS.md)；安全/隐私读 [`SECURITY_MODEL.md`](SECURITY_MODEL.md)；质量验收读 [`QA_RUBRIC.md`](QA_RUBRIC.md)。
6. 检查一个相邻示例的输入、证据文件、源码入口、测试和输出报告。涉及工具生态时读 [`TOOL_MATRIX.md`](TOOL_MATRIX.md)，并查询实时 catalog/doctor，不把“已登记”说成“可用”。

读完后，开始修改前在任务计划中简要说明：用户目标、相关入口和契约、目前已验证与未验证的能力、拟修改范围、将执行的验收命令。若文档与代码冲突，以实际代码和可复现证据描述现状，并指出冲突。

### 必须走哪条路径

- 纯代码/文档维护走普通工程路径。
- 只要任务涉及研究材料归档、页面设计或 PPTX 制作/交付，必须走下方 Harness deck 路径。不得把普通 `run` 的结构 QA 冒充完整 deck 验收。

### Harness deck 路径

1. 创建 `deck-plan.json`，用 `node src/harness.mjs plan validate --plan deck-plan.json` 检查。计划必须含范围/页数、已阅读且带 SHA-256 的材料、带实际证据的工具状态、全量逐页主张/证据/视觉来源/工具/权利状态、代表页和验收关卡。叙事章节必须在目录页列出；目录可紧跟封面或作为第一页。章节过渡页按计划顺序出现，每张内容页用 `section_name` 归属到一个已声明章节；这些页计入总页数，不能隐式插入。页数、源材料或设计冲突要明确列成待决项，不可默默推断；待决硬问题不得批准。
2. 指定审阅者批准计划：`node src/harness.mjs plan approve --plan deck-plan.json --reviewer "Name" --note "Reviewed scope, sources, page map and gates"`。批准绑定计划内容哈希。
3. 用仅含代表页的 Presentation IR 先做试制：`node src/harness.mjs run --task-type ppt --deck-plan deck-plan.json --input pilot-ir.json --workspace <workspace> --preview true`。在 Harness 产物中检查代表页，并按页提交 visual review 与 `--page-reviews`。
4. 将代表页审核的产物 SHA-256 记录进计划：`node src/harness.mjs plan representative-approve --plan deck-plan.json --reviewer "Name" --note "Reviewed representative slides" --artifact-sha256 <sha256>`。此后全稿 IR 必须精确匹配计划全部 slide ID 和页数，否则 Harness 拒绝运行。
   每个实际运行页的 `assertion` 还必须与 IR 的最终主标题（`assertion_title`，缺省时 `title`）一致；计划审批之后改写主标题会在渲染前被拒绝。
5. 全稿运行后，先检查 `workflow.critique.json` 的 `quality_gate`。它会自动阻断目录缺失/未列出全部章节、章节过渡页缺失或标题不符、章节过渡页未按阅读顺序预览该章节后续 1–3 页的原稿标题/断言、路线卡片未在渲染图中被 OCR 识别、路线与说明合计少于三行或可见文本占比低于 4.5%、内容页缺少章节归属，以及文字越界/重叠、任何位置（包括页脚区）小于 14pt、缺少显式字号的正文、主题外字体或无法测量字体的正文、渲染缺页、中文英文内容（单个长段或拆分到多个短块的段落）、对用户说话的助手口吻、正文解释少于计划下限（正式计划每页至少 40 个文本单位，汉字或非汉语单词各计一个单位）、实际成形视觉页比例不足（正式计划最低 50%，不得下调）、正文文字占比不足（视觉页至少 5.5%、无视觉页至少 7%，且均须至少两行可见解释）、OCR 检出的正文文字溢出文本框、图片小于页面 8%、图表/表格小于页面 15%、结构图/流程/卡片组的对象覆盖不足或整体占幅小于 12%、五页连续同构版式、整稿构图签名过少（至少五张内容页时，独特构图少于内容页的 40%，或同一构图占四页以上且不少于 60%）、单页堆叠三条及以上免责声明式句子、同一句免责声明在三页以上复用、核心/高重要度页面低于计划占比或讲解时间低于计划占比；修改源 IR 或计划后必须重新构建。版式签名依据页面类型、结构元素和可用的渲染对象分布计算，不采信计划自报的 `layout_intent`；代表页试跑不执行整稿多样性检查。Deck plan schema 1.2.0 要求目标讲解时长、受控重要度等级、核心页占比至少 25%、核心讲解时长占比至少 50%。若自动门禁通过，再分别提交 science、visual review。Deck visual approve 必须带 JSON 数组 `--page-reviews pages.json`，每页有 `status=pass`、`findings`（仅允许 `none` 或修复复查后的 `resolved: ...`）、`rechecked=true`，逐页包含 `rendered_page_sha256`（必须与 `review_context.rendered_page_sha256_by_slide` 中当前截图哈希一致），以及完整 `quality_checks`：`content_density`、`typography`、`visual_support`、`diagram_logic`、`narrative_role`、`presentation_voice`、`language_clarity`、`layout_variety`、`caveat_relevance`、`emphasis_depth`、`rendered_fit`。每项须写 `{ "status": "pass", "note": "..." }`；仅适用性确实不成立时才可用 `{ "status": "not_applicable", "note": "N/A: reason" }`。缺项、缺失/过期截图哈希、无理由 N/A、少于 12 个有效文本单位（汉字或英文词）的备注、同页不同维度重复备注或未解决发现都会阻止批准；备注需记录该页该维度的具体观察，但系统不能验证审阅者身份或保证观察诚实。审核绑定最终 PPTX 哈希与每页渲染图哈希。
    每个 `quality_contract.content_priorities` 项还必须通过逐页 `priority_ids` 映射到达到 `priority_depth` 要求的不同 core/high 页面；`standard` 至少 2 页，`deep` 至少 7 页。选择 deep 必须反映用户 brief 对机制/结果多页讲解的要求；deep 重点下每张核心页还必须声明 `explanation_stage`（`question`、`mechanism`、`evidence`、`comparison`、`result`、`implication`、`boundary`、`synthesis`），并覆盖至少 4 种阶段。core/high 页面也必须标注自己承担的声明重点。页数与阶段映射让重点分配可审计，但不能证明计划本身选对了重点或阶段内容真实推进，仍需在 `emphasis_depth` 审核中逐页确认。
   核心页的 explanation-depth 检查还会阻断同一重点页之间完全相同、或中文字符二元组/英文词元重叠达到 90% 的大段复用（至少 30 个不同词元），覆盖文本、项目符号、强调框和卡片正文。它能抓住近乎逐字换词复述，无法识别用大量不同词汇包装的语义重复；人工仍须逐页判断每张核心页是否推进了新的因果步骤、证据解读或结果含义。
6. 只有 Harness job 到达 `completed` 才能报告 deck 验收完成。计划批准、代表页批准或文件生成都不等于全稿完成。

工具命令、JSON 字段和失败条件详见 [`API_WORKFLOW.md`](API_WORKFLOW.md)。Harness 记录的是审阅者声明，不验证身份，也无法阻止有任意文件权限的 agent 在 Harness 外另行生成文件；项目交付声明必须引用 Harness run。

## 2. 工具熟悉与选择

先发现再选用，禁止为了“会用工具”而对所有工具逐一安装或调用：

| 目的 | 首选入口 | 使用前确认 |
|---|---|---|
| 查看命令/可用工具 | `npm run tools -- tools list`；`npm run tools -- tools doctor` | doctor 的实际探测结果、依赖、平台和限制 |
| 探测单个已注册工具 | `npm run tools -- tools test <id>` | 它测试的是 capability probe 还是端到端产物 |
| 生成用户演示 PPTX | `npm run validate`、`npm run build`、`npm run qa`、`npm run preview` | 输入/证据/资产、渲染器和预览依赖；检查每一页 |
| 本地完整检查 | `npm run check` | 该脚本覆盖范围及其副作用；它可能生成 `outputs/` 内容 |
| Project/Job/IR API 工作流 | 先读 `docs/API_WORKFLOW.md`；`npm run harness -- --help` 或 `npm run api -- --help` | Node 版本要求、workspace 位置、预览/审核状态和本地服务边界 |
| 技能、MCP、外部集成 | `skills/`、`.agents/skills/`、`docs/MCP_SERVER.md`、catalog | 实际入口、授权、是否联网/收费、数据发送范围；未经授权不调用付费 API 或上传私有材料 |
| Mermaid / 文档导入 / CSV / 研究流程 | 对应 README 章节、`package.json` scripts、`docs/` 专项说明 | 输入格式、合成数据标记、依赖和输出位置；读专项工具文档后再运行 |

工具状态必须准确表述为 catalogued、adapter-ready、smoke-tested、e2e-tested 或 blocked；“存在脚本/包/skill”不等于运行成功。执行任何命令前先检查它会读写哪些路径；保留现有用户生成物和未提交改动。

## 3. 每项工作的闭环

### A. 任务定义与基线

- 将用户目标拆成可观察的结果和明确不在本轮的范围；如有歧义，先做不依赖该歧义的检查。
- 记录 branch/upstream、HEAD、已暂存/未暂存 diff、未跟踪文件、全部 worktree；确认不会覆盖他人或既有工作。
- 选取与修改面相关的现有 fixture、测试、review/QA 报告作为基线。报告可能过时，记录实际重跑的项目。
- 写出具体实施步骤和通过条件；一次完成一个可检查的垂直切片。

### B. 实施与过程证据

- 先追踪调用链和 schema，再做最小模块化改动；新增行为同时补覆盖其契约的测试/fixture。
- 任何新增或变更的工具集成，更新机器可读 catalog 与人类可读状态/限制，并提供可复现探测或端到端证据。
- 保持来源 ID、locator、hash、verification 状态、图表数值和素材权利信息沿流水线传递。抽取/hash 不等于事实或许可验证。
- 生成物写入忽略目录或任务指定目录。明确标注 synthetic、draft、unverified 和 blocked；不伪造数据、引用、性能、视觉审核或成功状态。

### C. 验证、产物审查与验收

遵循 `AGENTS.md`：至少运行并记录 `npm run test`、`npm run validate`、`npm run build`。按改动风险增加负例（未知来源 ID、畸形图表、长文本、缺失依赖）和相关集成检查；不要以无关全量脚本代替针对性证据。

如果环境支持 LibreOffice/PowerPoint 与预览工具，运行 `npm run preview` 或对指定 deck 调用 `node scripts/preview.mjs <deck>`，逐页查看 PNG；记录页数、渲染环境和缺陷。只能写“文件已生成”不能写“视觉检查通过”。若依赖不存在，记录为 `blocked` 并说明缺失项，不得记为 pass。

验收记录至少包含：

- **功能**：目标行为的命令/输入/输出及对应测试证据；失败路径是否按预期失败。
- **科学与来源**：所有事实和数据的来源映射有效；未验证状态可见；数据值与确定性转换一致；不把 AI 草稿当事实。
- **结构与编辑性**：PPTX 页数、文本/形状/原生图表和可编辑性 QA；不能仅凭扩展名判断。
- **视觉**：逐页检查结果，或明确标记 blocked/not-run 并给出原因。
- **复现与安全**：命令、Node/依赖/渲染器版本、输入输出路径与必要 hash；网络/API、隐私、费用、素材许可边界已说明。
- **回归与交付**：测试结果、已知缺陷/限制、未完成验收项和下一步；Git 按根 `AGENTS.md` 的要求执行，未经明确要求不推送/合并。

硬门槛不允许被总分掩盖：来源错误、丢失内容、结构 QA 失败、未经授权的数据外传均为 fail；缺依赖或缺人工审核为 blocked/not-run，不是 pass。涉及正式用户 deck 时，机器检查通过仍需相应的人工科学和视觉审核。

## 4. 完成汇报模板

```text
目标 / 本轮范围：
改动文件及原因：
基线与工作树保护：
运行命令及准确结果：
生成物 / 页数 / 编辑性与来源检查：
逐页视觉检查：pass | blocked | not-run（证据或原因）
未解决缺陷、限制和授权依赖：
Git 分支/提交（仅在本轮确实执行时）：
下一阶段目标：
```

不得把未运行的命令、未打开的截图或未经人工确认的事实写成已验收。
