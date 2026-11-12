# Open-source engine POC results — 2026-11-12

## Scope and reproducibility

The only completed comparable authoring run uses the fixed nine-slide synthetic systems talk in `examples/open-source-bakeoff/`; its data (120/240/360 req/s) are fictional fixture values and `E_SYN_01` is unverified. No private research file, paid model/API, user account or cloud generation was used. This does **not** complete the directive's three task groups (academic source study, commercial market report, and six-slide style recreation). No cross-engine benchmark score is claimed.

Local outputs: `outputs/open-source-bakeoff/slidev-systems-talk.{pptx,pdf}`, `slidev-png/1.png…9.png`, contact sheet and object/QA reports; the opt-in adapter copy is under `artifacts/open-source-bakeoff/slidev-adapter/`. The `.pptx` contains 9 slides and notes, 9 text-editable slides, 72 native shapes, no native chart, and a rasterized Mermaid diagram. All nine Slidev PNG pages were reviewed. `outputs/research-demo` is a separate seven-slide native PptxGenJS baseline, not the shared comparison deck.

## Candidate run ledger

| Candidate | Version / SHA and command exercised | Result and artifact evidence | Editable output / incremental edit | Decision |
|---|---|---|---|---|
| PptxGenJS (baseline) | PptxGenJS 4.0.1; `npm run build`, `npm run validate`, `npm run preview`, `node src/qa.mjs outputs/research-demo.pptx` | **Pass** local build and rendering. 7 pages, 7 editable-text pages, 111 native shapes, 1 native chart/workbook; chart values match the storyboard. Visual review completed by this audit; formal user approval remains pending. | Native text/shapes/chart; not an external engine. Existing-PPTX selective text replacement has a separate local fixture workflow, not proof of general round-trip fidelity. | Keep as scientific output baseline. |
| Slidev | `@slidev/cli 53.1.0`, `@slidev/theme-default 0.25.0`, Playwright Chromium 1.65.0; local Chrome, Node 24.14.0. Commands in `examples/open-source-bakeoff/README.md`; opt-in wrapper `node scripts/run-slidev-backend.mjs …`. | **Pass** nine-slide synthetic PPTX, PDF and nine PNGs. Artifact and PPTX object QA listed above. No model call. | Text and many shapes editable; Mermaid image is raster; no native charts in tested deck. Sidecar preserves lineage. No single-slide regeneration/edit operation was validated. | Promote only as experimental auxiliary design backend, not scientific chart backend. |
| Presenton | Requested image `ghcr.io/presenton/presenton:v0.9.12-beta`; Docker `info`/`pull` attempted; API request wrapper `examples/open-source-bakeoff/run-presenton.ps1`. | **Blocked before install/start**: Docker Engine named pipe unavailable. No API key or provider was configured, no request sent, no deck created. | Unknown in this environment; do not infer from product claims. | Retry on Docker host with an approved local provider; record image digest, logs and object QA. |
| PPTAgent / DeepPresenter | PPTAgent checkout `9dacac53ac9ef39346461063df729396551d929e`; Python 3.12.7, uv 0.13.7. `--help` and `doctor` ran; Skill requirements install attempted. | **Partial setup only**: doctor identified missing PyMuPDF, Playwright, DeepPresenter and LibreOffice. Dependency install stopped building `fasttext==0.9.3` because MSVC C++ Build Tools were missing; WSL launch failed (`0x800705aa`). No generation/PPTX. Keep historical PPTAgent v0.2.0 and DeepPresenter v1.1.38 evaluations separate from current Skill. | No output to inspect. | Retry in supported Linux/WSL environment, use the same fixture and record whether any reviewer calls leave the machine. |
| slide-maker | Isolated source checkout `outputs/open-source-bakeoff/slides_maker-checkout`, SHA `a9e2d326d59f720873aa0ee5c58003c4f876b0e0`; MIT license present. Inspected upstream README, Skill and requirements; **not installed into the host**. | **Not run end-to-end**: this is an AI-assistant Skill, not a standalone generation CLI. Running its flow requires an Agent host and its conversational critic workflow. No skill installation or model/provider call was authorized/performed, and no output deck was generated. | Upstream describes editable text/shapes/charts and revision scripts; this remains unverified here. | Keep catalogued/experimental. To test, install in a disposable Agent profile and run only synthetic fixture with explicit provider/cost/privacy review. |
| SlidePoise | Isolated source checkout `outputs/open-source-bakeoff/slidepoise-checkout`, SHA `40480fd4fcfeb23771386b72fc697bdee2d268b4`; MIT license present. README/architecture inspected; no system setup run. | **Not run end-to-end**: the upstream workflow requires an Agent host, image-generation access, and local rendering tools. Running `setup` can install software and request administrator privileges; no such installation or image-generation call was made. No deck generated. | Upstream architecture claims reconstruction as editable native objects; no local output or object inspection to support that claim. | Keep catalogued/experimental. Retry with disposable environment and explicitly approved image-generation route. |

## Three shared-input groups

| Group | Present evidence | Missing before acceptance |
|---|---|---|
| Academic 5-minute source-based talk | Synthetic technical narrative exists; separate current research-demo build is 7 slides and carries explicit unverified warnings. | No shared original paper + validated raw data across all engines; no matched 5-minute timing test. |
| Commercial 10-minute metrics and risks | Hypothetical investment-committee CSV fixtures exist in the repo, but were not run through every candidate in this POC. | No common 10-minute brief and same-engine candidate output, nor market source validation. |
| Six-slide visual recreation | No common reference-PPTX recreation run was established. | Need a licensed/synthetic reference deck, fixed content and explicit style requirements; evaluate text/shape/chart editability and unchanged-slide behavior. |

## Cost, privacy, licensing and interpretation

Recorded model cost for completed local runs: **$0** (no model calls). This does not mean the AI Skill candidates are free to run; their documented flows may consume subscription/API credits and SlidePoise uses image generation. No source content was uploaded. Licensing status is separately audited in [`LICENSE_AUDIT.md`](LICENSE_AUDIT.md). A single synthetic export is not comparative evidence of design quality or source accuracy.

## Next executable phase

1. Repeat all four ecosystem candidates on their supported runtimes; install each in disposable folders only.
2. Execute one controlled source set per requested audience using the same content/data and a logged model/provider/cost policy.
3. Preserve each candidate's logs, exact SHAs, input hash, PPTX/PDF/PNGs, notes, object counts, per-slide edit tests and visual review.
4. Only then choose any new rendering adapter. Do not start a deep UI fork based on catalog entries or vendor claims.
