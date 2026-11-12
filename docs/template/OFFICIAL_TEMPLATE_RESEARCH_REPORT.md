# AIAutoSlides：全球官方幻灯片模板调研报告（研究阶段）

**日期：2026-11-12**

**目录规模：57 条**，分布：academic_conference 3, finance 2, government 3, government_lab 3, intergovernmental 3, professional_association 4, professional_services 1, public_research 1, research_lab 4, technology 9, tool_ecosystem 8, university 15。
**工作状态：已补录 26 个公开直链目标并实际尝试下载；16 个文件（173.5 MB）下载成功并通过 ZIP/PPTX 文件头校验，10 个目标因网络连接重置或分享页返回 HTML 未成功。二进制内容检查、许可证复核及 Windows PowerPoint 渲染 QA 尚未执行。**

## 0. Executive summary

这份报告针对用户需求书 `OFFICIAL_SLIDE_TEMPLATE_RESEARCH_BRIEF.md`，把“模板”细分为 institution-branded decks、官方示例/规范、工具官方主题。研究核心发现：**官方存在不等于公开下载，公开下载不等于再分发许可，PPTX 文件存在不等于可以被 PptxGenJS 原生导入**。因此研究资源目录和可以在 GitHub 自动安装的模板目录必须分离。

推荐的产品优先路线：
1. 可以直接安装的**开源工具**：PptxGenJS / Slidev 官方主题 / Marp / reveal.js / Beamer / Touying（许可证按依赖精确固定，检查嵌入资产）。
2. 可以优先**申请并本地评测**的原版官方模板：MIT CSAIL、Stanford School of Medicine、ETH Zurich、清华大学、Harvard Kempner、UMich Library、IEEE IAS、ACM ISS。**这些均不应因公开而自动上架可再分发模板库。**
3. 对 IBM Design Language、UK ONS、Goldman Sachs IR、Google/OpenAI 品牌资料，主要提取非专有的演示方法、数据可视化准则、信息架构；未经许可不得挪用机构品牌视觉资产或制作暗示背书的模板。
4. 新建统一 storyboard/evidence IR：源数据只定义一次；不同 renderer 支持不同的编辑性承诺。

## 1. 对四个重点机构的明确结论

| 机构 | 找到的官方资源 | 公开可得状态 | 允许项目重新分发？ | 建议 |
|---|---|---|---|---|
| MIT | 校级 PowerPoint / Google Slides；CSAIL 多版本 PPTX/KEY | 校级 Touchstone 登录；CSAIL 公共下载链接 | **未确定** | 优先本地分析 CSAIL，校级不自动获取 |
| Google | Google Slides 官方主题/模板，Google 品牌使用规则 | Slides 工具内可用，品牌规范公开 | **未确定** | 工具官方 ≠ Google 企业品牌母版 |
| Goldman Sachs | 品牌规范，公开投资者演示列表 | 公开浏览，企业母版未核实 | **未确定** | 仅作金融叙事、图表与脚注样例 |
| IEEE | IEEE Master Brand 资源入口；IAS PPT 模板；多种会议专用模板 | IAS / 年会页面有链接，品牌门户需核查 | **未确定** | 遵守协会活动与商标使用范围 |

官方入口：
- MIT central: https://brand.mit.edu/applying-brand/templates
- MIT CSAIL: https://www.csail.mit.edu/logo_asset_suite
- Google Slides: https://workspace.google.com/products/slides/
- Google brand: https://about.google/brand-resource-center/products-and-services/
- Goldman IR: https://www.goldmansachs.com/investor-relations/presentations
- Goldman brand: https://goldmansachs.papirfly.com/newsread/defaultViewer.aspx?docid=14373&nodeid=7307
- IEEE library: https://events.ieee.org/forms-and-templates/
- IEEE IAS: https://ias.ieee.org/about/branding-communications/

## 2. 目录概览

下表列的是研究入口，不是已经安装的文件。完整详情见 JSON / CSV，所有缺失信息均保留 `unknown`。

| ID | 机构 | 格式 | 获取情况 | 优先级 | 官方入口 |
|---|---|---|---|---|---|
| `mit-central` | MIT | PPTX / Google Slides | Touchstone required | P1 | [官网](https://brand.mit.edu/applying-brand/templates) |
| `mit-csail` | MIT CSAIL | PPTX / KEY / Google Slides-compatible PPTX | public links | P0 | [官网](https://www.csail.mit.edu/logo_asset_suite) |
| `stanford-med` | Stanford School of Medicine | PPTX | public link | P0 | [官网](https://med.stanford.edu/identity/how-we-use-it/powerpoint.html) |
| `stanford-spire` | Stanford S-SPIRE | PPTX / poster | public link | P2 | [官网](https://med.stanford.edu/s-spire/Resources/branding---identity.html) |
| `harvard-kempner` | Harvard Kempner Institute | PPTX / KEY / Google Slides | public links | P1 | [官网](https://kempnerinstitute.harvard.edu/kempner-community/communications-resources/) |
| `harvard-hms` | Harvard Medical School | PPTX | request via school email | P3 | [官网](https://identityguide.hms.harvard.edu/templates) |
| `harvard-seas` | Harvard SEAS | PPTX | Harvard ID and authorization | P2 | [官网](https://seas.harvard.edu/office-communications/brand-style-guide/logos-templates) |
| `berkeley-engineering` | UC Berkeley College of Engineering | Google Slides / PPTX | CalNet required | P1 | [官网](https://engineering.berkeley.edu/news/press-kit/brand-toolkit/resources/) |
| `berkeley-campus` | UC Berkeley | Google Slides | CalNet required | P2 | [官网](https://brand.berkeley.edu/downloads/google-templates/) |
| `berkeley-its` | Berkeley Institute of Transportation Studies | PPTX | faculty / staff; others contact | P2 | [官网](https://its.berkeley.edu/about-us/its-brand-toolkit/its-brand-assets) |
| `cmu-compbio` | Carnegie Mellon University CompBio | PPTX | public listing | P1 | [官网](https://cbi.cmu.edu/about-us/brand-guidelines.html) |
| `eth` | ETH Zurich | PPTX / LaTeX in ZIP | public ZIP listing | P0 | [官网](https://ethz.ch/staffnet/en/service/communication/corporate-design/templates.html) |
| `ucl` | University College London | PPTX | public listing | P1 | [官网](https://www.ucl.ac.uk/brand-and-experience/brand/brand-resources/templates) |
| `cambridge` | University of Cambridge | PPTX | University SharePoint | P2 | [官网](https://www.cam.ac.uk/brand-resources/guidelines/templates) |
| `cambridge-chem` | Cambridge Chemistry Postdocs | PPTX / PDF | mixed | P3 | [官网](https://pdac.ch.cam.ac.uk/poster-and-presentation-templates) |
| `georgia-tech` | Georgia Institute of Technology | PPTX / ZIP | Georgia Tech login | P2 | [官网](https://brand.gatech.edu/brand-assets/presentation-templates) |
| `umich-library` | University of Michigan Library | Google Slides / PPTX | public Google Drive folder | P0 | [官网](https://design-system.lib.umich.edu/visual-elements/document-templates-and-guidelines/) |
| `tsinghua` | Tsinghua University | PPTX | public attachments | P0 | [官网](https://www.env.tsinghua.edu.cn/info/1344/7931.htm) |
| `imperial` | Imperial College London | PPTX | brand platform / unclear | P3 | [官网](https://www.imperial.ac.uk/staff/tools-and-reference/web-guide/training-and-events/materials/accessibility/documents/) |
| `oxford-ndorms` | Oxford NDORMS | PPTX (described in PDF) | request / unknown | P3 | [官网](https://www.ndorms.ox.ac.uk/files/for-staff/ndorms-brand-guidelines.pdf/view) |
| `microsoft-create` | Microsoft PowerPoint / Microsoft Create | PPTX | gallery / account may be required | P0 | [官网](https://create.microsoft.com/en-us/powerpoint-templates) |
| `google-slides` | Google Workspace | Google Slides | in app, Google account | P0 | [官网](https://workspace.google.com/products/slides/) |
| `google-brand` | Google | guidelines | public page | P2 | [官网](https://about.google/brand-resource-center/products-and-services/) |
| `ibm-developer` | IBM Developer | PPTX | redirects to IBM sign-in during opening | P0 | [官网](https://www.ibm.com/brand/experience-guides/developer/implementation/templates/) |
| `ibm-design` | IBM | design tokens / charts / typography | public guidance | P0 | [官网](https://www.ibm.com/design/language/resources/) |
| `apple-keynote` | Apple Keynote | KEY | inside Keynote | P2 | [官网](https://support.apple.com/guide/keynote/create-a-presentation-tan317e80e8c/mac) |
| `openai-brand` | OpenAI | visual guidelines | public | P2 | [官网](https://openai.com/brand/) |
| `anthropic-trademark` | Anthropic | visual/trademark guidelines | public | P3 | [官网](https://www.anthropic.com/legal) |
| `atlassian` | Atlassian | brand assets / presentation kit | login required | P2 | [官网](https://atlassian.design/get-started/content-design) |
| `goldman-brand` | Goldman Sachs | brand guidelines | public page | P1 | [官网](https://goldmansachs.papirfly.com/newsread/defaultViewer.aspx?docid=14373&nodeid=7307) |
| `goldman-ir` | Goldman Sachs Investor Relations | PDF / presentation decks | public | P0 | [官网](https://www.goldmansachs.com/investor-relations/presentations) |
| `mckinsey-viz` | McKinsey & Company | design practice description | public | P2 | [官网](https://www.mckinsey.com/careers/our-roles/internal-roles/capabilities-and-roles/visual-graphics-and-media) |
| `ieee-master` | IEEE | PPTX (linked) | linked brand portal | P0 | [官网](https://events.ieee.org/forms-and-templates/) |
| `ieee-ias` | IEEE Industry Applications Society | PPTX | public download link | P0 | [官网](https://ias.ieee.org/about/branding-communications/) |
| `ieee-ias2026` | IEEE IAS Annual Meeting 2026 | PPTX | public link | P1 | [官网](https://ias-am.ieee.org/2026/presenting-at-conference/) |
| `acm-iss2026` | ACM ISS 2026 | PPTX | public download link | P0 | [官网](https://iss.acm.org/2026/authors/papers/) |
| `acm-chi2022` | ACM CHI 2022 | PPTX | public link | P2 | [官网](https://chi2022.acm.org/for-attendees/resources-for-presenters/) |
| `ccf-tc` | CCF China Computer Federation | PPTX | public listing | P3 | [官网](https://www.ccf.org.cn/Chapters/TC/Downloadt/) |
| `ccf-usage` | CCF China Computer Federation | rules | public page | P1 | [官网](https://www.ccf.org.cn/Chapters/TC/FAQ/2020-05-19/702409.shtml) |
| `nih-irp` | NIH Intramural Research Program | PPTX 4:3 / 16:9 | public links | P0 | [官网](https://irp.nih.gov/irp-brand-materials/irp-powerpoint-templates) |
| `nasa-ixpe` | NASA IXPE | PPTX | public link | P1 | [官网](https://ixpe.msfc.nasa.gov/for_scientists/templates/) |
| `nasa-apollo` | NASA | presentation | public download | P1 | [官网](https://www.nasa.gov/stem-content/downloadable-apollo-16-presentation/) |
| `cdc-education` | CDC | PPTX | public download links | P1 | [官网](https://portugues.cdc.gov/healthy-youth/communication-toolkit/communication-templates.html) |
| `doe-cmei` | US Department of Energy CMEI | PPTX | Energy Hub login / approved request | P3 | [官网](https://www.energy.gov/cmei/communicationstandards/brand-guidelines-office-critical-minerals-and-energy-innovation) |
| `uk-ons` | UK Office for National Statistics | PPTX guidance and internal template | ONS internal | P0 | [官网](https://service-manual.ons.gov.uk/brand-guidelines/application/creating-powerpoint-presentations) |
| `eu-study` | EU Study in Europe | PPTX / PDF | public downloads | P1 | [官网](https://erasmus-networks.ec.europa.eu/book-page/study-europe-toolkit/digital-visual-resources/presentation-templates) |
| `eu-gateway` | European Commission Global Gateway | PPTX / design system | public download listing | P0 | [官网](https://international-partnerships.ec.europa.eu/policies/global-gateway/communication-resources_en) |
| `eu-ecl` | European Commission | HTML/CSS component system | public | P2 | [官网](https://ec.europa.eu/component-library/ec/) |
| `pptxgenjs` | PptxGenJS | JS / PPTX | public npm/github | P0 | [官网](https://gitbrent.github.io/PptxGenJS/docs/masters) |
| `slidev` | Slidev | Markdown / Vue / HTML | npm and GitHub | P0 | [官网](https://sli.dev/guide/theme-addon) |
| `slidev-themes` | Slidev | npm theme packages | public repo | P0 | [官网](https://github.com/slidevjs/themes) |
| `marp` | Marp Team | Markdown / HTML / PDF / PPTX | public npm/GitHub | P0 | [官网](https://github.com/marp-team/marp-cli) |
| `reveal` | reveal.js | HTML / CSS / Markdown / PDF | public GitHub | P1 | [官网](https://github.com/hakimel/reveal.js) |
| `beamer` | LaTeX Beamer | LaTeX / PDF | CTAN | P0 | [官网](https://ctan.org/pkg/beamer?lang=en) |
| `metropolis` | Metropolis Beamer Theme | LaTeX / PDF | GitHub / CTAN | P1 | [官网](https://github.com/matze/mtheme) |
| `touying` | Touying / Typst | Typst / PDF / experimental PPTX | public GitHub | P1 | [官网](https://github.com/touying-typ/touying) |

## 3. 四类使用权限判断

- **可直接安装（installable tools）**：指遵守许可证的工具代码/官方主题代码，例如 MIT 许可的 Slidev、Marp、reveal.js；不等于可以自动下载任意含有品牌 Logo 的 deck。
- **需适配与人工审核**：公开的大学、协会、机构官方模板，可能允许机构内部制作演示但没有授予外部模板库再分发权。
- **仅设计/叙事研究**：投资者 PDF、品牌手册、企业案例 deck、UI design system，没有明确 PowerPoint 母版导入和复用权。
- **禁止自动导入**：内部泄露、登录后受限文件未经授权复制、未知版权聚合站、混淆第三方仿制和官方授权的资源。

**最重要的实现约束**：logo 权限单独存储为 `brand_permission`，不要把“公共领域”或开源代码许可自动继承给 logo、字体、照片与商标。不能用机构名命名一个声称官方背书的模板。许可核查是权限门槛，不是普通加权评分。

## 4. 技术路径比较

| 来源 | 推荐输出 | 文字/图表编辑性 | 接入路径 | 风险 |
|---|---|---|---|---|
| 原生 PPTX/POTX | PPTX | 有机会保留原生对象，但须逐项检测 | Python-pptx 占位符映射；备选 OOXML 复制/补丁 | Slide Master、关系和媒体、主题、notes 易损坏 |
| PptxGenJS 配置母版 | PPTX | 文本、形状、原生 chart 可编辑 | 编译许可确认的 token -> defineSlideMaster | **不支持直接导入现有模板** |
| Keynote | KEY；导出 PPTX | 具体取决于导出 | Apple Keynote 受控转换器，macOS | 母版/字体/动画差异 |
| Google Slides | Google Slides；导出 PPTX | 有编辑性但导出效果须检测 | Google Slides API/手动导出，单独 connector | 账号、模板权限、font fallback |
| Slidev | HTML / PDF | 网页内容可维护；PPTX 对象级能力不能保证 | 分离 HTML renderer 与 PPTX renderer | 直接转 PPTX 可能扁平化 |
| Marp | HTML / PDF / PPTX | 标准 PPTX 为预渲染图片；实验 editable 模式不稳定 | Marp CLI 官方工具 | 编辑模式页面不保真、notes 受限 |
| reveal.js | HTML / PDF | 网页原生可修改；PPTX 原生对象不作为核心目标 | HTML renderer | 转换需要额外引擎 |
| Beamer / Metropolis | PDF | PDF 文本可复制，但非原生可编辑 PPTX | latexmk / XeLaTeX | 数学优越，PPTX 原生编辑不足 |
| Typst / Touying | PDF，实验 PPTX | 实验模式仅部分对象转换 | typst / Touying | PPTX 兼容性不成熟 |

技术来源：
- PptxGenJS 原作者 2025 答复：https://github.com/gitbrent/PptxGenJS/discussions/1393
- PptxGenJS 母版说明：https://gitbrent.github.io/PptxGenJS/docs/masters
- python-pptx 占位符：https://python-pptx.readthedocs.io/en/stable/user/placeholders-using.html
- Marp 导出限制：https://github.com/marp-team/marp-cli/blob/main/README.md
- Slidev 官方主题：https://github.com/slidevjs/themes
- Beamer：https://ctan.org/pkg/beamer?lang=en
- Touying：https://github.com/touying-typ/touying

## 5. 推荐架构：将“发现、许可、呈现、导入、渲染、QA”分层

```text
Discovery Registry / Official Sources
  -> Evidence + Trademark + License Gate
  -> Catalog (JSON, SQLite, cached metadata, source snapshots)
  -> Gallery (Preview image + badge + permissions + output contract)
  -> Import Intent (reference_only | user_authorized_local | installable_code)
      -> PPTX Native Adapter (placeholder mapping, OOXML QA)
      -> PptxGenJS Theme Compiler (token/layout schema)
      -> Keynote / Google Slides Export Adapter
      -> Slidev / Marp / reveal.js HTML Renderer
      -> Beamer / Touying PDF Renderer
  -> Normalized Storyboard + Evidence Ledger + Native Chart Data
  -> Artifact QA (editability + lineage + accessibility + screenshot diff)
  -> Portable export (PPTX | PDF | HTML | source bundle)
```

### Source and license gating

建议加 `approval_state`: `research_only`, `local_evaluation_approved`, `internal_use_approved`, `redistribution_approved`。公共目录只存链接和研究元数据；下载的第三方品牌资产默认放到本地 `.gitignore` 目录。对已下载资源记录 checksum，验安全检查包括 ZIP 爆破/路径穿越/宏/外部关系/图片来源/字体许可。

### Native template import PoC

1. 用 python-pptx 读取本地用户合法获得的 PPTX，列出 `slide_masters`, `slide_layouts`, placeholder `idx/type`, theme colors, fonts, speaker notes, native chart parts。
2. 建立 `layout_mapping.json`：`title`, `assertion_evidence`, `chart`, `diagram`, `closing` 映射到既有 layout；试用占位符写入。
3. 在同一 native deck 上测试图表编辑和替换；无法保障 OOXML 完整时 fail closed，不允许转换成整页图片来冒充可编辑。
4. 生成编辑能力报告（content, shape, native chart, notes, lineage, master preserved）和版本依赖记录。
5. 若 native import 失败，保留合法本地 deck 仅作研究参考，不把它迁到 PptxGenJS 伪装成“导入成功”。

### Evidence contract

每张幻灯片需保存 `slide_id`, `claim_ids`, `evidence_ids`, `source_urls`, `synthetic_flag`, `review_status`, `renderer`, `template_id`, `render_checksum`。图表的系列数据需按 evidence_id 检查数值稳定性。AI 生成文案保留为 draft 状态。

## 6. 质量评分框架和淘汰线

**先门槛，再评分。**

- 法律可用门槛（PASS / CONDITIONAL / FAIL）：官方源可证；有实际许可；商标不误用；不得违反登录和身份约束。只有 PASS 可以用于自动集成。CONDITIONAL 只允许经用户授权的本地评测。
- 对通过门槛的模板，候选权重：视觉质量 16%、专业适配 14%、内容容量 14%、编辑性 18%、转换稳定性 12%、无障碍 10%、国际化 7%、维护/复现 9%。每项 1–5 分；没有预览或未实际运行不打分，留 `null`。
- 决策线（提案值）：任一版权/品牌 FAIL 不进入部署；native PPTX 任一关键编辑性需求 FAIL 不可作为可编辑 PPTX 引擎；加权分 >=4.0 进入优先试点、3.2–4.0 可选、其余仅参考。

## 7. 最少三个 bake-off 实验：方案已指定，当前未执行

**共用合成 storyboard**：5 页，封面、claim + supporting evidence、三组虚构数据的原生柱状图、结构图/来源、总结。所有数值加 `SYNTHETIC TEST DATA` 标记。内容完全中性，不含真实机构宣称。

1. `university_native`: MIT CSAIL 或清华大学 PPTX（仅在个人本地依法取得并确认试验许可后运行）。检测 masters、placeholder、notes、editable chart、logo 内容安全。
2. `corporate_native_or_reference`: IBM Developer 或 Microsoft Create（前者需登录，后者需在 Microsoft 许可范围内取得）。检测 PPTX 可编辑能力与品牌权利；如果不获授权则不执行品牌模板测试，改选自有中性主题。不可把自有主题测试冒称 IBM 模板测试。
3. `non_pptx`: Slidev 官方 themes + Marp + Metropolis，测试 HTML/PDF 生成和 PPTX（Marp 常规 vs experimental），明确报告 native shape/chart counts；编辑性达不到契约时转为 PDF/HTML 并行引擎。

每个实验产物：input.json、source-record.json、command.txt、renderer version.txt、output.pptx 或 PDF、PNG preview、qa.json、SHA-256、人工检查结论。**本轮已下载目录中列明的公开直链资源；这不代表所有目录条目都有可下载文件，也不代表已验证版式质量。**

## 8. 推荐分期

**Phase 0：资源和合规（约 1–2 开发日，估算非实际耗时）**：导入目录、校验脚本、许可门槛和证据 ID；界面分“官方来源”“本地授权”“可分发工具”三个状态。

**Phase 1：可用工具引擎（约 3–5 开发日）**：继续使用 PptxGenJS 原生 PPTX，新增 Slidev/Marp 并行 HTML/PDF，写 export_capabilities matrix。把主题 token 提取到 renderer-neutral IR。

**Phase 2：授权模板本地导入 PoC（约 4–8 开发日）**：选 2–3 个合法取得的 PPTX 文件验证 placeholder 路径；风险最高，必须设定 fail-closed 的 QA。

**Phase 3：自动化质量评测（约 3–7 开发日）**：LibreOffice PDF/PNG 预览（最终仍需要 PowerPoint Windows 检查）、OOXML shapes/charts/notes 核验、license assertions 和回归测试。

以上是工程任务粗估，不是已经执行的时间/成本事实；具体依赖现有代码基础、模板复杂度和目标质量。

## 9. 立即可执行的 Codex 验收标准

- Catalog validator 可以校验所有条目的字段、URL、source status、无 `license=free` 推断；所有未知字段显示 unknown/null。
- 用户可以通过 UI 看官方来源、格式、使用限制、是否存在实际下载链接和已确认编辑性。
- 任何 `official_but_license_unclear` 的素材不得自动安装；Git 库和构建 artifacts 不含受限模板/Logo/专有字体。
- PPTX 出现整页图片且无法编辑文字/图表时 `editable_pptx_contract` 自动失败。
- 每个 renderer 都要写自身支持的 `native_chart`, `speaker_notes`, `formula`, `lineage`, `editable_shapes`, `cjk_font` 能力并经过验证。
- 正式启用前须有三项具备实际渲染预览、哈希和详细对象检查的 bake-off；未测试不能标成 PASS。

## 10. 重要风险与开放问题

1. 各机构 brand guide 的更新频率、授权范围和第三方字体许可变化很快。目录应周期性人工复核。
2. PptxGenJS 原生导入是架构风险，不能直接增加“上传 PPTX”按钮就宣称支持所有模板。
3. Unicode/CJK、Mac/Windows font fallback、LaTeX math/PPTX OCR fallback 都需要独立 QA。
4. 很多学术会议只规定首尾页用其模板，用户通用研究报告不应被强制套用。
5. 金融机构真实 deck 可以研究图表和 narrative patterns，但不等于可以转存品牌母版或传播客户敏感材料。

## 11. 路径说明

此目录只包含**研究元数据、公开官网链接及工程指导，不包含任何大学/企业/协会的模板原文件、Logo、字体或受限制材料**。研究数据日期 2026-11-12，未经二进制下载和 Office 渲染检验。JSON `quality_score` 全部为 null，避免伪造评分。


## 附录：已定位的六个直接文件入口（不等于许可确认）

| 机构 | 格式 | 文件直链 | 状态 |
|---|---|---|---|
| MIT CSAIL | PPTX | [官方 PPTX](https://www.csail.mit.edu/sites/default/files/CSAIL-logo-Server_Assets/PPTX-Key/CSAIL_GSlide-Vertical_footer%5BArial-font%5D.pptx) | 官方链接已定位；未下载检查 |
| Stanford School of Medicine | POTX | [官方模板](https://med.stanford.edu/content/dam/sm/identity/documents/how-we-use-it/SOM_16x9_PPT.potx) | 官方链接已定位；未下载检查 |
| NIH Intramural Research Program | PPTX | [16:9 版](https://irp.nih.gov/system/files/media/file/2022-01/IRP_MasterPPT_2019-02-08_16x9.pptx) | 官方链接已定位；未下载检查 |
| European Commission Global Gateway | ZIP | [2026 版](https://international-partnerships.ec.europa.eu/document/download/382b13a7-1fdc-4232-b2c4-9e6d3fc70b60_en?filename=global-gateway-brand-book-2026-ppt-presentation-template.zip) | 官方链接已定位；未下载检查 |
| IEEE IAS | PPTX | [官方模板](https://ias.ieee.org/wp-content/uploads/2025/09/IAS-PPT-Template.pptx) | 官方链接已定位；未下载检查 |
| 清华大学环境学院 | PPTX | [科技主题](https://www.env.tsinghua.edu.cn/2025nianduyanshiwengaomoban5-kejizhuti.pptx) | 官方链接已定位；未下载检查 |

*特别注意：POTX 是模板文件，与普通 PPTX 应区别处理；直接文件 URL 可能随时间失效，也不构成可修改或重新发布的授权。*
