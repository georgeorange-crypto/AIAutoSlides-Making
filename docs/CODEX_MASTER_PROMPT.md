# Codex Master Task — Build AIAutoSlides Making into a Research-Grade AI Presentation Engine

> Version: 2026-11-12 · Language: 中文为主，代码、文件名与专业术语用英文。
> **运行方式：** 先在本项目根目录启动 Codex，再把本文件全文交给 Codex；或在 Codex 对话中发送 `Read AGENTS.md, docs/CODEX_MASTER_PROMPT.md, and docs/RESEARCH_APPLICATION_MATRIX.md. Execute Milestone 1 in this checkout, not just a plan.`

## 0. 你的角色与执行原则

你同时担任 Senior AI Presentation Engineer、AI Systems Research Engineer、Scientific Communication Designer、Design System Engineer、QA/Accessibility Auditor。你的任务是**在当前仓库实际实现、运行、验证、修复并交付**一套高质量 AI 自动幻灯片工程，不是输出空泛建议、伪代码、不可复现 demo 或冗长计划。

- **以仓库现状为可信起点，而不是从零重写。** 首先阅读 `AGENTS.md`、`README.md`、`docs/CONFIGURATION.md`、`docs/SCHEMA.md`、`docs/REFERENCES.md`、`docs/CODEX_TASK.md`，扫描代码、测试和 Git 状态。当前 v0.1.0 是 Node 20+ / PptxGenJS JSON→editable PPTX MVP；已有 7 页科研 Demo、3 套主题、evidence ledger、基础验证、可选 AI 分镜接口及 CI 草案。务必自行重新运行测试，**不得只相信 README 上的历史通过记录**。
- **默认不需要云 API、付费服务或用户密钥。** 本地 JSON/Markdown/CSV → PPTX 应独立工作。使用 OpenAI 或其他厂商 API 必须显式启用；配置通过 `.env`，不得把密钥、敏感未公开研究素材或私人文件提交 Git。
- **不许编造研究数据。** 所有数值必须能够追溯至输入文件、数据行/实验 ID、处理脚本和生成图表；区别 user-provided/unverified、verified、synthetic、hypothetical。无来源的数值或指标不得自动补齐；不得伪造 error bar、显著性、置信区间、引用或会议政策。对声称科学因果或统计优势的句子加证据门槛。
- **优先可编辑交付。** 原生 PPTX 字体、文本框、矢量图形、图表和演讲备注优先；可选 HTML/PNG/PDF 输出必须明确标注 PPTX 编辑保真限制。凡整页当图片导出，不得宣称“editable PPTX”。
- **先做真实工作的闭环。** 每个阶段都要新增/改进真实文件、执行命令、产出文件、截图/渲染图与测试报告；发现错误要修复，不得仅制定计划。进度充分时持续工作，在权限或时间受限时完成可验证的部分并列出 blockers。
- **变更控制。** 在创建新结构前核对现有结构；保持兼容性。安装新依赖时说明必要性、版本与许可证；涉及远端 push、发布、付费 API、私密云上传等不可逆/外部行为时先要求许可。不要私自创建 GitHub 仓库、部署到 Vercel 或调用第三方付费服务。

## 1. 目标产品与用户任务

产品名称：**AIAutoSlides Making**。

用户主要做 AI Systems / LLM Infra / 系统性能科研。主要场景：每周科研组会、国际学术会议口头报告、论文答辩、复杂实验复盘、教学课程展示；拓展场景：投资委员会或商业分析报告、科技产品 Keynote。目标是建设**内容可信、审美出众、可编辑、可复现、可持续批量更新**的个人 Slides 工具链。

最终原则：`Sources → Evidence Ledger → Audience/Goal → Storyboard → Design Tokens → Visual Assets → Editable Deck → Render → Scientific/Visual QA → PPTX/PDF/HTML/Source`。

同一份来源数据要支持两种分歧输出：
- `talk`: 现场讲演、信息聚焦、分阶段揭示、单页一个论点、附讲稿；
- `reading`: 离线阅读、更多实验方法/定义/条件/出处/限制，不是把 Talk Deck 图片简单拼接。

三类核心受众 Profile：`research_group`、`academic_conference`、`investment_committee`，定义其论证和视觉检查项，不要把融资 pitch 规范机械套用到 SIGMETRICS/IMC 技术报告。

## 2. 逐源吸收调研成果：必须做到“来源 → 规则 → 代码/测试”

下面不是要求复制这些机构的模板、商标、字体和受版权保护的幻灯片，而是要求读**公开官方材料**，抽象可以工程化的通用原则，并在 `docs/RESEARCH_APPLICATION_MATRIX.md` 中补充你实际核验过的链接、截取的原则、实现位置、测试 ID、验证日期、限制说明。不能把个人博客当成机构官方政策；不能将 2025 年 ACM 某场会议规范冒充 2027 年 SIGMETRICS 规定。

### A. 大学与认知研究
1. **MIT EECS Communication Lab** — https://mitcommlab.mit.edu/eecs/commkit/slideshow/ ：观众/目的先行；每页传达清晰信息；结论式标题；实验结果关联动机。落实 `assertion_title`、`audience_profile`、`narrative_outline`、`message-per-slide` QA。
2. **CMU PowerPoint Design** — https://www.cmu.edu/student-success/other-resources/resource-descriptions/powerpoint-design.html ：Assertion–Evidence；在技术页以图形或数据作为证据，删除无关文字。实现 `assertion-evidence` 布局和对应 rubric；不要禁用所有列表。
3. **Michael Alley / Penn State** — https://www.writing.engr.psu.edu/speaking.html 、https://www.writing.engr.psu.edu/research.html ：科学呈现方法与实验研究。区分“研究得到的证据”与未经检验的审美经验，不要声称所有研究均适用某万能模板。
4. **Harvard T.H. Chan** — https://hsph.harvard.edu/research/health-communication/resources/slide-checklist/ ：字体、投影可读性、对比度、留白、可访问性，形成明示阈值和静态/渲染 QA。
5. **UCSD** — https://multimedia.ucsd.edu/best-practices/presentation-design.html ：认知负荷、突出要点、渐进呈现复杂内容；生成 `progressive_reveal` 可选标记（不强求未经验证的 PowerPoint 动画自动生成）。
6. **Stanford GSB** — https://www.gsb.stanford.edu/insights/communication-tips-classroom-around-world ：先故事后软件，避免把正文当提词器。落实 storyboard-first gate 和演讲者备注。

### B. 硅谷科技公司/VC/著名设计师
7. **Apple WWDC “Presenting Design Work”** — https://developer.apple.com/videos/play/wwdc2018/811/ ：目标/受众/真实情境/对比演示/节奏/练习。落实 Keynote 风格组件与 `rehearsal_notes`，但不得复制 Apple 官方模板和视觉资产。
8. **Y Combinator / Kevin Hale** — https://www.ycombinator.com/blog/how-to-design-a-better-pitch-deck ：Legible / Simple / Obvious，落实可读性、信息密度与层级检查。
9. **Sequoia** — https://sequoiacap.com/article/writing-a-business-plan/ ：使命、问题、为何现在、解决方案、竞争和决策问题；仅应用于 pitch / investment 场景。
10. **Google developer style** — https://developers.google.com/style/images ：清晰的系统图、干净的截图、文本避免栅格化；落实 SVG/矢量资产路线。
11. **Nancy Duarte** — https://www.duarte.com/resources/books/resonate/ 、https://www.duarte.com/resources/books/slideology/ ：现状 vs 可能的新状态、对比、转折；作为可选 narrative template 而非自动夸张结论。
12. **Garr Reynolds** — https://www.garrreynolds.com/tips ：删减装饰与无效文字，建立高留白主题。
13. **Cole Nussbaumer Knaflic** — https://www.storytellingwithdata.com/book/downloads ：数据故事、对比重点、删去 chart junk；不能为了“好看”截断坐标轴而误导。

### C. 金融机构/华尔街专业组织
14. **J.P. Morgan Startup Banking** — https://www.jpmorgan.com/insights/business-planning/creating-an-investor-pitch-deck-for-your-startup ：完整故事、简洁、可信进展、明确 ask。标记这是 startup pitch 指导，**不是**投行内部 Pitchbook 工作规范。
15. **CFA Institute** — https://rpc.cfainstitute.org/blogs/enterprising-investor/2017/six-presentation-tips-for-finance-professionals ：数据与图表要解释“so what”，体现风险、假设和决策含义。落实 `investment_committee` 的风险/假设/决策页模板。

### D. 国际学术会议/协会
16. **IEEE Author Center** — https://conferences.ieeeauthorcenter.ieee.org/become-an-ieee-conference-author/present-your-paper/ ：时间限制、核心贡献、图表/可读性。
17. **ACM CSCW 2025 Accessibility** — https://cscw.acm.org/2025/index.php/accessible-presentation-guidelines/ ：字幕、字号、颜色对比、无障碍阅读；明确是特定会议某一年的建议。
18. **USENIX slide guide** — https://www.usenix.org/legacy/events/samples/slide.guide.pdf ：大字号、少量信息、从后排可读。
19. **ACM Creativity & Cognition 2025** — https://cc.acm.org/2025/videoprep/ ：录制/视频压缩环境下的文字和布局安全区。
20. 对实际投稿会议（如 SIGMETRICS/IMC）要检索当年讲者说明，新增 `conference_profiles/<conference>-<year>.json`；**只有官方当年资料**才能标记 `requirement`，通用建议必须标记 `recommendation`。未找到就标记 `unverified`，不要猜。

### E. 现成产品 / 开源复用与对接策略
21. **PptxGenJS** — https://github.com/gitbrent/PptxGenJS ：**核心真实 editable PPTX 引擎**；优先利用官方原生文本、图表、形状、notes 能力，避免重复造轮子。
22. **Quarto** — https://quarto.org/docs/presentations/ ：数据分析/Markdown→revealjs/PPTX/Beamer，作为可选高级后端或导入中间结构的参考，不是主引擎替代品。
23. **Slidev** — https://sli.dev/guide/exporting ：技术讲演 Web 输出；区分 image-backed PPTX 与 `pptx-editable` 实际转换效果；要有实验对比。
24. **Marp** — https://github.com/marp-team/marp-cli ：Markdown 快速制作/构建理念；保留真实 editable PPTX 对比测试。
25. **Zara Zhang / Frontend Slides** — https://github.com/zarazhangrui/frontend-slides 、https://deck.zarazhang.com/ ：借鉴“先展示可视化风格选项→用户选择→设计规则持久化→再生成”的分阶段 UX。**先审查其许可证**；若没有允许复制的许可证，仅做理念层面的独立实现，不复制 SKILL、CSS、模板、图片或动画代码。
26. **Gamma** https://gamma.app/ 、**Canva** https://www.canva.com/ 、**Beautiful.ai** https://www.beautiful.ai/ 、**Figma Slides** https://www.figma.com/slides/ 、**Microsoft PowerPoint/Copilot** https://www.microsoft.com/en/microsoft-365/powerpoint/ 、**Google Slides** https://slides.google.com/ 、**Napkin AI** https://www.napkin.ai/ ：作为产品能力与 UX Benchmark 的比较对象。只做公开可用/授权 API 的可选 Adapter；不要依赖浏览器爬取、逆向收费接口或冒充官方集成，不强制付费。
27. **Codex project instructions** — https://learn.chatgpt.com/docs/agent-configuration/agents-md 、https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex ：保持 `AGENTS.md` 简洁，复杂任务拆文档和阶段清单，可通过测试证据闭环。

### F. 个人社区经验（用于设计反例和 Benchmark，不是权威方法论）
- Rachel DeJulio 的双周报告自动化复盘：https://growthlever.substack.com/p/i-tried-two-ways-to-automate-my-bi ；关注第一次搭建成本、第二次更新成本、Tableau→PPTX→Google Slides 保真问题。
- Reddit 咨询从业者复盘：https://www.reddit.com/r/consulting/comments/1vri8fx/ ；关注人工修稿、幻觉、信息层级。
- Reddit 半年产品比较：https://www.reddit.com/r/AI_Agents/comments/1vlh7c0/ ；关注导出保真与真实客户模板适配。
- Reddit 同一页美化实验：https://www.reddit.com/r/powerpoint/comments/1r8odde/ ；关注修改了原始数字和元素溢出。
- YouTube Slides by Sander：https://www.youtube.com/watch?v=4s6Hcryz7x0 ；关注 Office 后编辑能力。
- YouTube ExplorIA：https://www.youtube.com/watch?v=HNouDXt5jKQ ；关注 Claude / Gamma / Agent+Skills 不同路线。
- X 与 Discord：公开可验证的具体项目、仓库或可观看 Demo 才加入比较；不可核对的帖子与封闭频道不应伪装成独立证据。

## 3. 目标技术架构（渐进实现，不做一次性过度工程）

保留当前 `src/cli.mjs` + `src/render.mjs` + `src/validate.mjs` 路线，考虑逐渐演化以下模块；如实际架构更简洁，记录理由即可：

```text
input-adapters/      markdown, csv; pdf/docx optional and carefully sourced
schemas/             typed storyboard, data source, evidence, theme, output profiles
evidence/            provenance graph, integrity and verification labels
storyboard/          audience/duration-aware structured plan, manual & optional AI
styles/              theme tokens, 16:9 grid, typography, palette, charts
layouts/             assertion-evidence, before-after, metrics, architecture, table
plots/               bar, line, scatter, cdf, latency waterfall (real data)
renderers/           pptx first; experimental html/pdfs behind flags
qa/                  data audit, editable-object audit, text bounds, pixel review
benchmarks/          accuracy, repair time, update time, editability, presentation QA
cli/                 reproducible inspect/plan/build/validate/render/benchmark
```

源材料与成品之间要有可追溯连接：`source_file + source_hash + row_or_section_locator + transform + figure_id + slide_id + assertion + verification_status`。重要统计数值必须保留单位、基线、样本数/分布、汇总方式，并区分 P50、P95、Mean、标准差。

输出建议：`deck.pptx`, `deck.pdf`, `contact-sheet.png`, `storyboard.json`, `evidence-manifest.json`, `qa-report.json`, `qa-report.md`。有条件时生成 `rehearsal-notes.md`。

## 4. 首轮必须实际完成的 Milestone 1（不要跳过）

**M1.1 再现基线与风险审计**
- `npm install` / `npm ci`（按实际 lockfile 状态）、`npm run check` / `test` / `validate` / `build`；记录 Node、OS、依赖版本、exit code。
- 读取 README 与实际代码，检查命令是否存在、输出路径是否真实；发现不可用 API 模型名、过期链接、无效步骤要纠正。
- 核对 GitHub Actions 是否使用锁文件，锁定版本和相应权限；避免额外秘密和后台外网调用。

**M1.2 内容生产的完整闭环**
- 新增 `examples/from-csv/`，含**显式标为 SYNTHETIC 的数据**、真实导入 CLI 和至少 1 个可编辑图表示例。
- 支持 Markdown 文本输入/大纲优先（可先转受控 JSON）；为每个 slide 附稳定 `slide_id`, `assertion_title`, `evidence_ids`, `speaker_notes`。
- 至少完成 1 个 `research_group` / `talk` 模式样例，8–10 页；保留现有 7 页 Demo 兼容。

**M1.3 高质量可编辑渲染**
- 实现并实际使用 4 种可复用布局：`assertion-evidence`, `two-column-contrast`, `metric-focus`, `chart-and-takeaway`。
- 维持/改进 3 套主题；统一 tokens（字体候选/回退、字号、颜色、间距、网格、图表风格），不要依赖不随仓库授权分发的字体文件。
- 原生文字与图表可编辑；允许研究架构图以 SVG 矢量插入，但不能将整套 slides 贴图伪装可编辑。

**M1.4 数据与视觉 QA**
- 扩充验证：来源缺失、数值/单位错误、axis labels 缺失、样本数不明、数据序列不匹配、空标题、过长正文、图表断轴风险、非 16:9 等。
- 实际导出 PPTX→PDF→PNG（有 LibreOffice/Poppler 时），逐页检查裁切/字体/对比度/可读性/留白。自动 QA 失败必须返回非零 exit code；视觉主观问题在报告中标记待人工审核。
- 用 unzip 检查 PowerPoint XML 中可编辑文本、原生图表和嵌入数据。最小 QA 报告必须区分 `pass/warning/fail/unverifiable`。
- 加测试与 GitHub Actions；CI 无付费 API 调用；失败时不能发布成功标志。

**M1.5 文档与亲自使用准备**
- 更新 README 为**Windows PowerShell 优先**，另给 Linux/macOS；零密钥示例、换主题、换 CSV、写自定义分镜、渲染、查 QA 报告都可复制运行。
- 新增 `docs/RESEARCH_APPLICATION_MATRIX.md`，把每一条借鉴过的外部规范映射到实际代码/检查项，明确需要进一步手动复核的资源。
- 新增明确的 `docs/PRODUCT_BENCHMARK.md`：制定可复现的竞品对照协议而不是编造产品得分；至少准备 3 种真实可公开/合成的输入样例、统一评分量规和记录模板。
- 输出 demo PPTX/PDF/PNG、可读 QA 报告。不要谎报没有执行过的测试，不得掩盖阻塞。

## 5. 之后的里程碑（M1 完成之后按优先级推进）

**Milestone 2 — Science-grade figures & research workflow**
- 多系列 bar/line/scatter/CDF，分组、统计汇总/置信区间仅在真实重复实验支持时开放；单位、对照组、样本数完整。
- 真实实验结果更新后自动差分重绘，计算 `first-run` 与 `second-run` 生产耗时；报告人工修正工作量。
- `talk` / `reading` 两套输出从同一份证据图分叉，不重复生成/虚构结论。
- PDF/DOCX 解析可选择离线方案；扫描件 OCR 不自动宣称可信。

**Milestone 3 — Presentation Intelligence**
- LLM storyboard 采用 schema-constrained output、source grounding、幻觉检测与明确的人审关卡；保留可编辑人工修订文件。支持不同受众和演讲时长。
- `Slide Critic`: 审核 Assertion–Evidence、YC 可读/简单/直观、Harvard 对比度、IEEE 时长、科研论证、公平图表和来源核验；每条建议附规则 ID 和元素坐标或 slide_id。
- 先生成 3–5 个风格缩略图再选择，保存用户确认过的 `design.md` / tokens，减少重复 Prompt；尊重外部 Frontend Slides 项目的许可证。

**Milestone 4 — Multi-backend & ecosystem**
- Quarto、Slidev、Frontend Slides 原型仅在确有价值且许可允许时单独试验；严谨比较导出对象可编辑性、保真、渲染稳定性，不强行共用完全不同布局引擎。
- Gamma、Canva、Beautiful.ai、Figma、PowerPoint Copilot、Google Slides、Napkin：先记录产品能力与经过独立验证的适用场景；只有公开支持且用户已授权的 API 才开发 Adapter。
- 可选 Google Slides/Canva GitHub 集成，不强制账号连接；禁止将用户未公开科研资料默认上传。

## 6. 测试标准与 Benchmark 记录

**必须具备的质量维度（100 分建议权重）：**
- 科学准确性/数据来源 25
- 叙事与逻辑 20
- 视觉证据与图表质量 20
- 视觉设计一致性 15
- 可读性与无障碍 10
- 工程交付（原生可编辑、可更新、可复现）10

**硬性失败：** 虚构数据或引用；不符合真实实验的图；重要内容裁切；声称原生可编辑但输出为全页图片；引用链断裂；CI 运行失败却宣称成功；向外部服务泄露未获授权的研究资料。

**Benchmark 用相同任务、输入、时间预算、人工编辑规则：**
1. 8–10 页科研组会（数值 + 架构 + 决策页）
2. 5–7 页投资/商业分析（有假设、风险、决策 ask）
3. 技术演讲（复杂流程图、公式/代码、可读性）

记录：首次生成耗时/人工修复分钟数、第二次数据更新耗时、原始数值保真率、引用完整率、PPTX 可编辑对象比例、溢出数量、统一 Rubric 的盲审分数；没有测量不要填写数字。社区帖子和厂商宣传只能用于提出假设，不能当 Benchmark 测量值。

## 7. 交付格式（每轮必须真实交付）

1. Summary：这轮完成的功能与仍未完成的部分。
2. Change log：逐项列出修改的文件与目的。
3. Commands / Evidence：列出真实执行命令、返回状态、生成路径、可复现测试结果。
4. Slide visual review：所有页面的渲染数量、缩略图和具体检查结论；不能只看首页。
5. Scientific integrity：数值的来源状态、引用问题、是否存在未核验数据。
6. PPTX editability audit：文本、图表、形状以及可能栅格化的对象。
7. Benchmark / CI：实际得到的结果及未测试项目。
8. Blockers & next action：明确下一阶段的单一优先事项和具体验收条件。

**立即开始：从 `AGENTS.md` 和上述 Milestone 1 开始，真实改代码、测试和渲染；不要只写计划，不要用未经核验的外部内容填充示例。**
