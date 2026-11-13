# Open-source engine POC results — 2026-11-12

## Scope and reproducibility

The shared nine-slide synthetic systems talk is the same synthetic fixture used in the Slidev, PPTAgent and Presenton routes; its 120/240/360 req/s values are fictional and `E_SYN_01` is unverified. No private research file, paid model/API, user account or cloud generation was used. Presenton used a local deterministic API stub, not a model. This does **not** complete the directive's three task groups (academic source study, commercial market report, and six-slide style recreation). No cross-engine benchmark score is claimed.

Local Slidev outputs: `outputs/open-source-bakeoff/slidev-systems-talk.{pptx,pdf}`, nine PNGs, contact sheet and object/QA reports; adapter copy: `artifacts/open-source-bakeoff/slidev-adapter/`. Presenton outputs (PPTX, PDF, nine PNGs) are local ignored files under `outputs/open-source-bakeoff/presenton-mock/` and are not committed. PPTAgent artifacts and object reports are under `artifacts/open-source-bakeoff/pptagent/`. `outputs/research-demo` is a separate seven-slide native PptxGenJS baseline.

## Candidate run ledger

| Candidate | Version / SHA and command exercised | Result and artifact evidence | Editable output / incremental edit | Decision |
|---|---|---|---|---|
| PptxGenJS (baseline) | PptxGenJS 4.0.1; `npm run build`, `npm run validate`, `npm run preview`, `node src/qa.mjs outputs/research-demo.pptx` | **Pass** local build and rendering. 7 pages, 7 editable-text pages, 111 native shapes, 1 native chart/workbook; chart values match the storyboard. Visual review completed by this audit; formal user approval remains pending. | Native text/shapes/chart; not an external engine. Existing-PPTX selective text replacement has a separate local fixture workflow, not proof of general round-trip fidelity. | Keep as scientific output baseline. |
| Slidev | `@slidev/cli 53.1.0`, `@slidev/theme-default 0.25.0`, Playwright Chromium 1.65.0; local Chrome, Node 24.14.0. Commands in `examples/open-source-bakeoff/README.md`; opt-in wrapper `node scripts/run-slidev-backend.mjs …`. | **Pass** nine-slide synthetic PPTX, PDF and nine PNGs. Artifact and PPTX object QA listed above. No model call. | Text and many shapes editable; Mermaid image is raster; no native charts in tested deck. Sidecar preserves lineage. No single-slide regeneration/edit operation was validated. | Promote only as experimental auxiliary design backend, not scientific chart backend. |
| Presenton | Image `ghcr.io/presenton/presenton:v0.9.12-beta`, commit `93b9dcf947f70ae107b779b51dd3c491e736748a`, digest `sha256:dd444e4384df0caeb7cb96a26bfa7543a12d2be19c83d661446b2087d09aed54`; authenticated request wrapper plus deterministic local Node mock. | **API/export pass with mock:** 1 layout + 9 content completions, PPTX generated, PowerPoint exported PDF, Poppler rendered 9 PNGs. No model inference. | 9/9 text slides, 18 native text shapes, 45 picture objects, 0 charts/tables, 9 notes; all 9 page images reviewed and title truncation on 8/9 pages and card clipping on 9/9 pages. IDs preserved in speaker notes. | Keep optional and isolated; post-export QA is mandatory. Real model behavior and arbitrary PPTX import/edit remain untested. See `PRESENTON_POC.md`.
| PPTAgent / DeepPresenter | PPTAgent checkout `9dacac53ac9ef39346461063df729396551d929e`; official Skill `pptagent==1.1.37`; WSL Ubuntu 24.04, Python 3.12.3, Node 24.18.1, Playwright 1.62.0, LibreOffice. | **Complete local conversion/review loop:** nine deterministic HTML slides built into PPTX/PDF; official `finalize` reported `complete=true`, `delivery_ready=true`; all nine final pages inspected. | 9/9 editable-text slides, 116 shapes, 17 lines, 2 native tables, 0 pictures/charts; HTML source is editable, but arbitrary existing-PPTX round-trip is not verified. | Keep optional HTML-to-PPTX path after AIAutoSlides lineage and chart QA. Details: `PPTAGENT_POC.md`. |
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
