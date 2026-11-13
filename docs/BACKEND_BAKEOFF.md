# Backend bake-off: Presenton, PPTAgent, Slidev

**Test date:** 2026-11-12 · **Fixture:** the shared nine-slide synthetic/hypothetical technical talk in `examples/open-source-bakeoff/synthetic-systems-talk.md` and `synthetic-evidence.json`. No private research input, external model API, external account key or paid endpoint was used. Presenton used and removed a short-lived local API key; no credential is retained.

## Decision

Slidev and PPTAgent completed local export loops for the shared nine-slide synthetic talk. Slidev generated editable PPTX/PDF/PNG; PPTAgent generated editable PPTX/PDF and nine reviewed page renders from the same slide assertions, caveats, source ID and synthetic values. PPTAgent's package has editable text, native shapes and tables, but no native chart objects. Presenton v0.9.12-beta completed authenticated generation and PPTX/PDF export APIs against a local OpenAI-compatible schema mock (no model deployed or paid call). Its mock-generated deck contains editable text and shapes, but its nine-page visual review failed clipping/collision checks. This establishes API and export integration only, not model-driven authoring quality.

Keep AIAutoSlides' current PptxGenJS renderer as the **main scientific output backend**: it maps evidence IDs and deterministic values and can generate native charts under AIAutoSlides' source-aware QA contract. Use **Slidev as the first auxiliary Markdown/Vue authoring backend** and **PPTAgent Skill as a second optional HTML-to-editable-PPTX path**. Neither external backend produced a native PowerPoint chart in this test; use them for design/text/shape work only until chart parity and source-sidecar checks are added. Presenton remains an optional isolated service candidate pending a permitted model-driven quality run. The tested results do not establish comparative aesthetic or AI content quality.

## Shared content and provenance

- Input: [`synthetic-systems-talk.md`](../examples/open-source-bakeoff/synthetic-systems-talk.md) (9 slides, `S01`–`S09`); fixed-content Presenton request: [`presenton-request.json`](../examples/open-source-bakeoff/presenton-request.json); evidence: [`synthetic-evidence.json`](../examples/open-source-bakeoff/synthetic-evidence.json).
- All claims and the 120/240/360 req/s load tiers are invented only as explicit synthetic fixture values. `E_SYN_01` is `verified:false`; no scientific meaning is assigned.
- Stable slide IDs and source ID appear in speaker-note comments/source sidecar. Slidev export has no AIAutoSlides lineage by itself; the sidecar remains the provenance authority.

## Local setup / commands / observed result

| Backend | Version and isolated setup | Command / configuration exercised | Result |
|---|---|---|---|
| Slidev | `@slidev/cli 53.1.0`; `@slidev/theme-default 0.25.0`; Playwright Chromium `1.65.0`; Node `v24.14.0`; Chrome `C:\Program Files\Google\Chrome\Application\chrome.exe`. Packages reside under ignored `outputs/m4/slidev-lab`; project manifest and lockfile were not changed. | Commands are reproducible from `examples/open-source-bakeoff/README.md`; format `pptx-editable`, `pdf`, `png`, clicks disabled. | **Pass:** 9-page PPTX, PDF, 9 PNGs. Local exporter needs no AI API. |
| Presenton | Official tag `v0.9.12-beta` commit `93b9dcf947f70ae107b779b51dd3c491e736748a`; pulled image digest `sha256:dd444e4384df0caeb7cb96a26bfa7543a12d2be19c83d661446b2087d09aed54`; Apache-2.0. | Docker Linux engine 29.9.3; initial Ollama setup hit model-not-found after blocked blob redirect. Follow-up `LLM=custom` run used local ephemeral Node mock, schema-conforming SSE responses, and disabled image generation/web search/Mem0/anonymous tracking. | **Partial API/export pass:** 10 streamed completions; PPTX and PDF exported (hashes and sizes in [`PRESENTON_POC.md`](PRESENTON_POC.md)); 9/9 text-editable, 18 native shapes, 45 pictures, 0 charts/tables. Mock fixture visual review failed title clipping and body/card collisions; not evidence of actual model quality. Container, temporary app data and credentials were removed. |
| PPTAgent | Upstream commit `9dacac53ac9ef39346461063df729396551d929e` (2026-11-08); MIT; official Skill requirements `pptagent==1.1.37`, Python 3.11+, uv, npm, LibreOffice, Linux/WSL or macOS. Isolated Python 3.12.3 runtime and Chromium under ignored outputs; official `doctor` passed in Ubuntu 24.04 WSL. | Used official Skill `review-slides` → per-slide review records → `build` → `review-deck` → manual inspection of all nine final pages → `record-deck-review` → `finalize`. Fixture generator: `examples/open-source-bakeoff/pptagent/create-slides.mjs`. | **Pass: complete local HTML-to-PPTX loop.** `finalize` `complete=true`; PPTX/PDF/nine page renders. OOXML: 9/9 text-editable slides, 116 native shapes, 17 line objects, 2 native tables, 0 pictures, 0 native charts. Native QA counts/visual evidence: [`PPTAGENT_POC.md`](PPTAGENT_POC.md) and [`artifacts/open-source-bakeoff/pptagent/`](../artifacts/open-source-bakeoff/pptagent/). Native Windows dependency build previously failed on `fasttext`/MSVC; WSL is the tested route. |

### Slidev artifact inventory

Files are local ignored outputs (not committed):

- `outputs/open-source-bakeoff/slidev-systems-talk.pptx`
- `outputs/open-source-bakeoff/slidev-systems-talk.pdf`
- `outputs/open-source-bakeoff/slidev-contact-sheet.png` (9-page overview; individual pages remain available under `slidev-png/`)
- `outputs/open-source-bakeoff/slidev-png/1.png` … `9.png`
- `outputs/open-source-bakeoff/slidev-objects.json` (object counts)
- `outputs/open-source-bakeoff/slidev.qa.json` and `.md` (AIAutoSlides package inspection)

Command `node src/qa.mjs outputs/open-source-bakeoff/slidev-systems-talk.pptx` reported **9 slides, 9 text-editable slides, 0 native charts**. Direct Open XML inspection found 9 slides, 59 editable text shapes, 13 additional editable shapes, one picture object, zero native chart parts, and one embedded PNG. Per-slide details are in the JSON report. The picture is the Mermaid architecture diagram; its labels are not native editable text in the tested deck. Slidev documentation warns some SVG/Mermaid and other complex content remains a picture. Text, tables, and card shapes were editable; the synthetic numeric table values were preserved as text, not chart series. All 9 slides contain a notes part; the source comments are not visible slide objects.

## Slide-by-slide visual QA (PDF/PNG render from Slidev)

Each of the nine PNG pages was opened at full resolution after the cover typography adjustment. No clipping, overlaps, missing slide, or unreadable body text was observed. Content is a clean, high-contrast default theme; visual hierarchy and whitespace are consistent. Limitations are qualitative: style is sparse/default rather than a polished editorial theme; title wrapping is two lines on the cover; Mermaid diagram is an image; no footers/page numbers; source IDs are in notes/sidecar, not a visible footer. The synthetic table is legible and keeps the unit with each value. A future polished theme should add visible source/status labels and a native chart test before considering Slidev for research-output generation.

## External dependency, API and licensing record

- **Slidev:** MIT CLI and default theme; npm install and browser export were local. Chromium is required. The exporter warned recipient font substitution is possible (`Arial`, `trebuchet ms` named but not embedded). No network asset fetch or model call was part of export. Complex visual content may rasterize and text wrapping can differ in PowerPoint.
- **Presenton:** Apache-2.0 project, with third-party dependency/model licenses still relevant. Service requires a self-hosted container or Electron app and API authentication. It supports Ollama and OpenAI-compatible custom providers. The POC used a local mock endpoint only; no hosted model, private data transfer, or paid call occurred. The initial Ollama attempt remained blocked by model download.
- **PPTAgent:** MIT project; dependencies include deeppresenter, Playwright, PyMuPDF, image/PDF packages and Node packages. Official Skill supports Linux/WSL/macOS and LibreOffice. It can use a host agent/model and optional vision review API; those calls may be external. No provider was configured or called.

## Existing native route as the baseline

On this checkout, `npm run build` generated `outputs/research-demo.pptx` with seven slides. `npm run validate` and the build emitted the missing chart sample-size warning and two `verified:false` evidence warnings. Full `npm run check` passed with 52 tests, including negative source-ID, chart-data, unsupported slide type, long-text and tool-catalog checks. This is direct evidence that existing scientific gates and native charts work for the repo's test cases; it is not a same-content visual comparison with the nine-slide external POC. During the audit upstream `origin/dev` advanced to `607443816f17c3979be8125b5f54b29247528df9`; local `HEAD` is `ef29168`, and the dirty working tree contains separate untracked P0 registry/IR files. The audit leaves these distinctions visible; it does not count the untracked catalog as a public-dev release.

## M1–M4 implementation boundary

- **M1:** PptxGenJS MVP, seven-slide sample, themes, evidence-backed storyboard validation, native editable text/shapes/chart path, local build/preview and CI. Direct baseline `build`/`validate` ran; warnings stayed visible.
- **M2:** deterministic CSV/chart workflows (bar, line, scatter, CDF, multi-series and repeated runs/error bars), audit/refresh manifests and provenance. `npm run check` exercises the synthetic imports, builds and QA; values originate in fixtures.
- **M3:** audience/duration narrative metadata, three theme choices, deterministic Slide Critic, content-bound human review gate, theme comparison. Existing CI runs the hand-labeled 24-case rule-state fixture; this is not semantic claim verification or aesthetic validation.
- **M4:** latest public dev includes local PDF/DOCX text import with source/extraction hashes and locators, image manifest/hash/license/status plus PPTX embedding, synthetic one-row update benchmark, and initial three-slide Slidev comparison. M4 does not establish OCR, arbitrary PPTX round-trip editing, backend parity, or external-service sync.
- **Current worktree follow-on (M3A/P0):** local untracked additions include an `architecture` slide type rendered as native shapes/connectors, a 10-slide synthetic multimodal demo, and tool registry/IR drafts. `node scripts/build-multimodal-demo.mjs`, `validate`, `build --assets`, and `node src/qa.mjs` were run in this audit: 10 slides, 155 native shapes, 28 connectors, 1 native chart, exact CSV chart values (`420, 315, 360`), 10/10 editable-text slides, and a 4.85:1 minimum declared-theme contrast. The warnings are the three intended `verified:false` synthetic sources. Pixel-level review for this deck was not completed; desktop preview is unavailable/had previously hung according to the local M3A report. Treat these capabilities as current workspace work, not as `origin/dev` behavior.

Milestone details: [`M1_IMPLEMENTATION_REPORT.md`](M1_IMPLEMENTATION_REPORT.md), [`M2_FIGURE_CORE_REPORT.md`](M2_FIGURE_CORE_REPORT.md), [`M3_IMPLEMENTATION_REPORT.md`](M3_IMPLEMENTATION_REPORT.md), and [`M4_IMPLEMENTATION_REPORT.md`](M4_IMPLEMENTATION_REPORT.md). The audit distinguishes code/run evidence from roadmap and report prose.

## Reproduction

Use the exact Slidev commands in [`examples/open-source-bakeoff/README.md`](../examples/open-source-bakeoff/README.md). Reproduce the Presenton mock API loop with `node scripts/run-presenton-mock-poc.mjs outputs/open-source-bakeoff/presenton-mock-poc-20261112`; see [`PRESENTON_POC.md`](PRESENTON_POC.md). A model-driven quality run remains unverified. For PPTAgent, see [`PPTAGENT_POC.md`](PPTAGENT_POC.md); the accepted artifact and upstream finalization evidence are committed.

## Remaining risks and next bake-off phase

1. Evaluate Presenton with a permitted model/provider to assess authored content and visual quality; the local mock already verified API and PPTX/PDF export but not model output.
2. Add a data-backed chart and speaker-note case to the shared fixture; require native charts/workbooks, visible/source-note lineage and numeric parity before recommending a design backend.
3. Assess importing/editing an existing synthetic PPTX; this POC demonstrates PPTAgent HTML-source editing/conversion, not round-trip import of arbitrary existing decks.
4. Complete bundled dependency/template/font/image license inventories before adapter distribution. Do not enable cloud generation in default builds or CI.

## Phase 2: isolated Slidev adapter

The CLI integration is now implemented in `packages/adapters/slidev.mjs` and `scripts/run-slidev-backend.mjs`, using the versioned local tool-adapter protocol. It accepts the original synthetic Markdown, exports `pptx-editable`, PDF, and PNG, optionally copies the stable slide/evidence lineage sidecar, and writes a versioned manifest with input and artifact hashes. It is opt-in and leaves the default PptxGenJS build unchanged. No AI/provider call or network content is used.

The adapter was run end to end with Slidev `53.1.0`, Node `v24.14.0`, and local Chrome. It produced all three formats and a nine-page PNG set. `node src/qa.mjs` reported **9 slides, 9 text-editable slides, 0 native charts**; all nine pages were visually inspected with no clipping or overlap found. PPTX, PDF, all PNG pages, lineage sidecar, manifest, and QA JSON/Markdown are committed under [`artifacts/open-source-bakeoff/slidev-adapter/`](../artifacts/open-source-bakeoff/slidev-adapter/). Adapter tests cover format selection, sidecar copying, manifest writing, and invalid input. This does not establish native chart support, sidecar-to-content semantic validation, import of existing decks, or parity with the AIAutoSlides scientific IR.

## Phase 3: Presentation IR mapping and note lineage

`packages/adapters/slidev-ir.mjs` and `scripts/slidev-from-ir.mjs` convert a supported subset of Presentation IR 1.0.0 to Slidev Markdown. Targeted tests passed 7/7; full `npm run test` passed 85/85 and `npm run check` exited 0. The synthetic fixture converts to 9 slides and retains its unverified status. An initial `load` export was correctly rejected for missing editable text. Retrying with `networkidle` completed the Windows loop: PPTX, PDF, 9 PNGs; lineage passed 9/9; structural QA found 9 text-editable slides, 79 shapes, 1 picture, 0 native charts; all pages were visually inspected. The chart fallback is an SVG picture, not a native PowerPoint chart; arbitrary assets/transforms and existing-deck import remain unsupported. Reproduction and evidence are in [`SLIDEV_IR_MAPPING.md`](SLIDEV_IR_MAPPING.md) and [`../artifacts/open-source-bakeoff/slidev-ir/`](../artifacts/open-source-bakeoff/slidev-ir/).

## Phase 4: Mermaid local helper integration

Mermaid CLI `12.2.0` was installed in the isolated `workers/mermaid` environment (`puppeteer@25.0.2`); doctor and synthetic smoke passed. The synthetic flowchart was emitted as SVG and PNG, and the PNG was visually opened. The SVG was then embedded through the existing Presentation IR asset contract and PptxGenJS adapter into a nine-slide deck. Structural QA found editable text/shapes plus one picture object on S03, with warnings for unverified synthetic evidence and pending image rights. Mermaid elements are not native PowerPoint shapes. The complete command record, hashes, adapter boundary, licensing caveats and visual-review limitation are in [`MERMAID_POC.md`](MERMAID_POC.md); artifacts are local under `outputs/open-source-bakeoff/mermaid-*` and ignored by Git.

The standalone diagram visual check passed; integrated deck visual review remains pending because no PowerPoint/LibreOffice CLI was available. Keep Mermaid as an optional diagram CLI feeding the existing PptxGenJS asset interface. It does not warrant another deck backend.
