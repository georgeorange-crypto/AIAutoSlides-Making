# Backend bake-off: Presenton, PPTAgent, Slidev

**Test date:** 2026-11-12 · **Fixture:** nine-slide synthetic/hypothetical technical talk in `examples/open-source-bakeoff/`. No private research inputs, model API, account key or paid endpoint was used.

## Decision

Only Slidev completed the export loop in this environment. It generated editable PPTX, PDF and PNG previews from the shared nine-page talk. Presenton was blocked before container startup because Docker Engine was not running. PPTAgent's current repository and CLI were inspected and invoked, but full generation was blocked by unsupported native Windows dependencies, absent LibreOffice, and a WSL startup failure. Neither blocked backend has a generated PPTX in this report.

Keep AIAutoSlides' current PptxGenJS renderer as the **main scientific output backend** because it already maps evidence IDs, deterministic data and native charts into its own build/QA contract. Use **Slidev as the first auxiliary design/authoring backend** for Markdown/Vue technical talks, while carrying a sidecar source manifest and reporting raster fallback. Consider Presenton as an isolated local generation service and PPTAgent as an optional agent workflow only after their complete loops run on supported hosts. This is not a claim that the current renderer has the best general visual design: only one tested Slidev deck and an existing three-page M4 comparison are available.

## Shared content and provenance

- Input: [`synthetic-systems-talk.md`](../examples/open-source-bakeoff/synthetic-systems-talk.md) (9 slides, `S01`–`S09`); fixed-content Presenton request: [`presenton-request.json`](../examples/open-source-bakeoff/presenton-request.json); evidence: [`synthetic-evidence.json`](../examples/open-source-bakeoff/synthetic-evidence.json).
- All claims and the 120/240/360 req/s load tiers are invented only as explicit synthetic fixture values. `E_SYN_01` is `verified:false`; no scientific meaning is assigned.
- Stable slide IDs and source ID appear in speaker-note comments/source sidecar. Slidev export has no AIAutoSlides lineage by itself; the sidecar remains the provenance authority.

## Local setup / commands / observed result

| Backend | Version and isolated setup | Command / configuration exercised | Result |
|---|---|---|---|
| Slidev | `@slidev/cli 53.1.0`; `@slidev/theme-default 0.25.0`; Playwright Chromium `1.65.0`; Node `v24.14.0`; Chrome `C:\Program Files\Google\Chrome\Application\chrome.exe`. Packages reside under ignored `outputs/m4/slidev-lab`; project manifest and lockfile were not changed. | Commands are reproducible from `examples/open-source-bakeoff/README.md`; format `pptx-editable`, `pdf`, `png`, clicks disabled. | **Pass:** 9-page PPTX, PDF, 9 PNGs. Local exporter needs no AI API. |
| Presenton | Upstream `ghcr.io/presenton/presenton:v0.9.12-beta` as shown by official package page; official project Apache-2.0. A fixed nine-slide API request and local-only PowerShell client are committed under `examples/open-source-bakeoff/`. | Attempted `docker info` and `docker pull ghcr.io/presenton/presenton:v0.9.12-beta`; both failed to connect to `npipe:////./pipe/docker_engine` (`The system cannot find the file specified`). API key was not created. | **Blocked before install/start.** Cannot verify fixed-content generation, PDF/PPTX export, provider-free behavior, or visual/object QA. The local Presenton server must have an allowed provider configured; no API/model call was made. |
| PPTAgent | Current upstream checkout at `9dacac53ac9ef39346461063df729396551d929e` (MIT); Skill requirements declare `pptagent==1.1.37`, Python 3.11+, uv, npm, LibreOffice, Linux/WSL or macOS. Python `3.12.7`, uv `0.13.7` were isolated under `outputs/open-source-bakeoff/`; checkout is also there. | `py -3.12 .../scripts/pptagent.py --help` passed; `doctor` ran and reported missing PyMuPDF, Playwright, deeppresenter, and LibreOffice. Attempted uv install of `skills/pptagent/requirements.txt`; it stopped compiling `fasttext==0.9.3` because Microsoft C++ Build Tools 14+ is missing. `wsl --status` showed Ubuntu 24.04, but launching WSL returned `0x800705aa`. | **Partial CLI/setup check only.** No slide rendering, editable PPTX, PDF, or visual review. The environment lacks official supported platform/runtime dependencies, not evidence of a backend defect. |

### Slidev artifact inventory

Files are local ignored outputs (not committed):

- `outputs/open-source-bakeoff/slidev-systems-talk.pptx`
- `outputs/open-source-bakeoff/slidev-systems-talk.pdf`
- `outputs/open-source-bakeoff/slidev-png/1.png` … `9.png`
- `outputs/open-source-bakeoff/slidev-objects.json` (object counts)
- `outputs/open-source-bakeoff/slidev.qa.json` and `.md` (AIAutoSlides package inspection)

Command `node src/qa.mjs outputs/open-source-bakeoff/slidev-systems-talk.pptx` reported **9 slides, 9 text-editable slides, 0 native charts**. Direct Open XML inspection found 9 slides, 59 editable text shapes, 13 additional editable shapes, one picture object, zero native chart parts, and one embedded PNG. Per-slide details are in the JSON report. The picture is the Mermaid architecture diagram; its labels are not native editable text in the tested deck. Slidev documentation warns some SVG/Mermaid and other complex content remains a picture. Text, tables, and card shapes were editable; the synthetic numeric table values were preserved as text, not chart series. All 9 slides contain a notes part; the source comments are not visible slide objects.

## Slide-by-slide visual QA (PDF/PNG render from Slidev)

Each of the nine PNG pages was opened at full resolution after the cover typography adjustment. No clipping, overlaps, missing slide, or unreadable body text was observed. Content is a clean, high-contrast default theme; visual hierarchy and whitespace are consistent. Limitations are qualitative: style is sparse/default rather than a polished editorial theme; title wrapping is two lines on the cover; Mermaid diagram is an image; no footers/page numbers; source IDs are in notes/sidecar, not a visible footer. The synthetic table is legible and keeps the unit with each value. A future polished theme should add visible source/status labels and a native chart test before considering Slidev for research-output generation.

## External dependency, API and licensing record

- **Slidev:** MIT CLI and default theme; npm install and browser export were local. Chromium is required. The exporter warned recipient font substitution is possible (`Arial`, `trebuchet ms` named but not embedded). No network asset fetch or model call was part of export. Complex visual content may rasterize and text wrapping can differ in PowerPoint.
- **Presenton:** Apache-2.0 project, with third-party dependency/model licenses still relevant. Service requires a self-hosted container or Electron app and API authentication. It supports local Ollama and hosted providers. No container, model download, private data transfer, or paid call completed.
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

Use the exact Slidev commands in [`examples/open-source-bakeoff/README.md`](../examples/open-source-bakeoff/README.md). For Presenton, start the official local container, create a local API key in the UI, and use `run-presenton.ps1` with the fixed request; verify provider mode and cost before generation. For PPTAgent, run its official setup in a functioning Linux/WSL/macOS environment, then use the same nine-section fixture and require render/review/build/finalize before claiming success.

## Remaining risks and next bake-off phase

1. Repeat Presenton and PPTAgent POCs on a host with Docker + local model or supported WSL + LibreOffice, and compare same-content PPTX/PDF/PNG.
2. Add a data-backed native chart and visible lineage labels to the shared fixture; inspect charts/workbooks, notes, text, shapes, images and overflow for each backend.
3. Assess importing/editing an existing synthetic PPTX; none of the completed external POCs in this phase demonstrates that workflow.
4. Pin container digest and all transitive licenses before adapter development. Do not enable cloud generation in default builds or CI.
