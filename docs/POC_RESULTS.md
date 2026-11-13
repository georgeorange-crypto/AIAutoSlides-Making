# Open-source engine POC results — 2026-11-12

## Scope and reproducibility

> **Evidence update (2026-11-12):** this ledger was initially written before the later WSL PPTAgent run and Presenton local-service probe. Those runtime facts have now been verified against checked-in files and local Docker/Ollama state; the initial “blocked before generation” entries are superseded below.

The only completed comparable authoring run uses the fixed nine-slide synthetic systems talk in `examples/open-source-bakeoff/`; its data (120/240/360 req/s) are fictional fixture values and `E_SYN_01` is unverified. No private research file, paid model/API, user account or cloud generation was used. This does **not** complete the directive's three task groups (academic source study, commercial market report, and six-slide style recreation). No cross-engine benchmark score is claimed.

Local outputs: `outputs/open-source-bakeoff/slidev-systems-talk.{pptx,pdf}`, `slidev-png/1.png…9.png`, contact sheet and object/QA reports; the opt-in adapter copy is under `artifacts/open-source-bakeoff/slidev-adapter/`. The `.pptx` contains 9 slides and notes, 9 text-editable slides, 72 native shapes, no native chart, and a rasterized Mermaid diagram. All nine Slidev PNG pages were reviewed. `outputs/research-demo` is a separate seven-slide native PptxGenJS baseline, not the shared comparison deck.

## Candidate run ledger

| Candidate | Version / SHA and command exercised | Result and artifact evidence | Editable output / incremental edit | Decision |
|---|---|---|---|---|
| PptxGenJS (baseline) | PptxGenJS 4.0.1; `npm run build`, `npm run validate`, `npm run preview`, `node src/qa.mjs outputs/research-demo.pptx` | **Pass** local build and rendering. 7 pages, 7 editable-text pages, 111 native shapes, 1 native chart/workbook; chart values match the storyboard. Visual review completed by this audit; formal user approval remains pending. | Native text/shapes/chart; not an external engine. Existing-PPTX selective text replacement has a separate local fixture workflow, not proof of general round-trip fidelity. | Keep as scientific output baseline. |
| Slidev | `@slidev/cli 53.1.0`, `@slidev/theme-default 0.25.0`, Playwright Chromium 1.65.0; local Chrome, Node 24.14.0. Commands in `examples/open-source-bakeoff/README.md`; opt-in wrapper `node scripts/run-slidev-backend.mjs …`. | **Pass** nine-slide synthetic PPTX, PDF and nine PNGs. Artifact and PPTX object QA listed above. No model call. | Text and many shapes editable; Mermaid image is raster; no native charts in tested deck. Sidecar preserves lineage. No single-slide regeneration/edit operation was validated. | Promote only as experimental auxiliary design backend, not scientific chart backend. |
| Presenton | Image `ghcr.io/presenton/presenton:v0.9.12-beta`, digest `sha256:dd444e4384df0caeb7cb96a26bfa7543a12d2be19c83d661446b2087d09aed54`; Docker Engine 29.9.3; evidence in `artifacts/open-source-bakeoff/presenton/runtime-evidence.json`; wrapper `examples/open-source-bakeoff/run-presenton.ps1`. | **Service/API smoke passed; generation blocked.** Loopback API HTTP 200; local admin setup/login and ephemeral key succeeded. Ollama selected (`qwen2.5:1.5b`), but local model inventory was empty and generation returned HTTP 404 “model not found”. No PPTX/PDF/PNG. Container and ephemeral credentials were removed. No paid API, image generation, tracking, or private input. | No output to inspect; editability and incremental editing remain unknown. | Generation requires an approved local model already installed/configured. Do not infer output fidelity from service smoke. |
| PPTAgent standalone Skill | PPTAgent checkout `9dacac53ac9ef39346461063df729396551d929e`; Ubuntu 24.04 / WSL 2; Python 3.12.3, `pptagent==1.1.37`, Node 24.18.1, LibreOffice; details in `PPTAGENT_POC.md`. | **Pass for deterministic HTML-to-PPTX conversion and review.** `final-report.json` says complete/delivery-ready. SHA `9ea231a90b8e39b9335c49127547296f4d09b512bfb58fff152d14f6034fee00` matches the checked-in PPTX. All nine PNG pages were reopened and visually inspected in this audit. | 9/9 editable-text slides, 116 native shapes, 17 connectors, 2 native tables, 0 pictures, 0 native charts. This validates conversion of repository-generated HTML, not model-driven authoring, arbitrary-PPTX round-trip, or unchanged-slide editing. | Keep as an optional HTML-to-PPTX path. PyMuPDF dual-license remains a distribution gate; full dependency notices still need review. |
| slide-maker | Isolated source checkout `outputs/open-source-bakeoff/slides_maker-checkout`, SHA `a9e2d326d59f720873aa0ee5c58003c4f876b0e0`; MIT license present. Inspected upstream README, Skill and requirements; **not installed into the host**. | **Not run end-to-end**: this is an AI-assistant Skill, not a standalone generation CLI. Running its flow requires an Agent host and its conversational critic workflow. No skill installation or model/provider call was authorized/performed, and no output deck was generated. | Upstream describes editable text/shapes/charts and revision scripts; this remains unverified here. | Keep catalogued/experimental. To test, install in a disposable Agent profile and run only synthetic fixture with explicit provider/cost/privacy review. |
| SlidePoise | Isolated source checkout `outputs/open-source-bakeoff/slidepoise-checkout`, SHA `40480fd4fcfeb23771386b72fc697bdee2d268b4`; MIT license present. README/architecture inspected. | **Not run end-to-end.** Offline Python test suite was attempted from a disposable venv with existing local Python packages; result: **390 passed, 6 skipped, 21 failed**. See offline verification below. No setup installer, Agent host, image generation, remote asset retrieval, or user materials were used; no deck generated. | Upstream reconstruction and editable-output claims remain unverified by this bakeoff. The Python suite is not a clean supported-runtime acceptance result. | Keep catalogued/experimental. Retry full CI in its declared isolated runtime, then use an Agent host and approved image generation for the shared synthetic fixture. |

### slide-maker offline toolchain verification — 2026-11-12

The upstream Skill was not installed into an Agent profile and its interactive generation workflow was not run. Its checkout remained read-only at SHA `a9e2d326d59f720873aa0ee5c58003c4f876b0e0`. A disposable Python 3.12 virtual environment under `%LOCALAPPDATA%\Temp\aiautoslides-slide-maker-poc-20261112` was used for local-only upstream checks; public Python dependencies and CairoSVG 2.9.1 were installed there, with no model, image-generation, research-network, or paid API call.

- `python scripts/smoke_deckkit.py`: **passed**, 0 failures after installing CairoSVG for SVG scaffold rasterization. The run emitted environment-font substitutions and expected fixture lint warnings; no source files were changed.
- `python scripts/check_tests_wired.py`: **passed**, 151 test files; 151 wired, 1 explicitly allowlisted, 0 problems.
- `python tests/test_codex_delivery_gate.py`: **passed**.
- `python tests/test_codex_visual_contract.py`: **passed**.
- `python tests/test_codex_scaffold_complete.py`: **passed**.

This raises confidence in the upstream offline drawing and delivery-gate code, but does not create a candidate deck, exercise the Agent-host interview/critic flow, or establish parity against the shared academic, commercial, or reference-deck inputs. The slide-maker bakeoff row therefore remains **not run end-to-end**, and Phase 0 remains incomplete.

### SlidePoise offline test attempt — 2026-11-12

The source checkout remained read-only at SHA `40480fd4fcfeb23771386b72fc697bdee2d268b4`. A temporary Python 3.12 environment was used for pytest and missing declared import dependencies; the test process also used the already-installed local AIAutoSlides research environment via `PYTHONPATH`, so this was not a clean install from SlidePoise's dependency declarations. Pytest's cache and basetemp were redirected to `%LOCALAPPDATA%\Temp`.

- Initial collection was blocked by absent `resvg_py` and `fontTools`; both were installed only in the temporary test environment.
- `python -m pytest -q`: **390 passed, 6 skipped, 21 failed** in 419.60 seconds.
- Failures include missing test-only `build` during the initial run; Windows symlink privilege errors in migration tests; an observed SQLite index replacement `PermissionError` on Windows; a reference-search HTTP fixture returning 400 instead of 200; and renderer subprocesses selecting the machine Python 3.10 with a broken UTF-8 site configuration. The checkout has no installed SlidePoise Node runtime dependencies, so this is not an end-to-end or release-compatible run. These failures were not “fixed” by modifying the upstream checkout.
- Final source checkout status remained clean. No Agent workflow, generated image, public asset fetch, cloud service, or candidate deck was exercised.

This confirms a substantial offline test surface exists and can run locally, while leaving several Windows/runtime failures unresolved. Phase 0 remains incomplete; no cross-engine quality or editability conclusion is drawn from this test attempt.

## Three shared-input groups

| Group | Present evidence | Missing before acceptance |
|---|---|---|
| Academic 5-minute source-based talk | Synthetic technical narrative exists; separate current research-demo build is 7 slides and carries explicit unverified warnings. | No shared original paper + validated raw data across all engines; no matched 5-minute timing test. |
| Commercial 10-minute metrics and risks | Hypothetical investment-committee CSV fixtures exist in the repo, but were not run through every candidate in this POC. | No common 10-minute brief and same-engine candidate output, nor market source validation. |
| Six-slide visual recreation | No common reference-PPTX recreation run was established. | Need a licensed/synthetic reference deck, fixed content and explicit style requirements; evaluate text/shape/chart editability and unchanged-slide behavior. |

## Cost, privacy, licensing and interpretation

This is a bounded Phase-0 candidate update, **not Phase-0 acceptance**. Presenton completed a service smoke but no deck; PPTAgent completed deterministic conversion but no AI authoring. slide-maker and SlidePoise remain unrun in an Agent host. The three matched task groups, source validation, edit-one-slide test, cross-engine comparison, complete dependency notices and human acceptance remain outstanding.

Recorded model cost for completed local runs: **$0** (no model calls). This does not mean the AI Skill candidates are free to run; their documented flows may consume subscription/API credits and SlidePoise uses image generation. No source content was uploaded. Licensing status is separately audited in [`LICENSE_AUDIT.md`](LICENSE_AUDIT.md). A single synthetic export is not comparative evidence of design quality or source accuracy.

## Next executable phase

1. Repeat all four ecosystem candidates on their supported runtimes; install each in disposable folders only.
2. Execute one controlled source set per requested audience using the same content/data and a logged model/provider/cost policy.
3. Preserve each candidate's logs, exact SHAs, input hash, PPTX/PDF/PNGs, notes, object counts, per-slide edit tests and visual review.
4. Only then choose any new rendering adapter. Do not start a deep UI fork based on catalog entries or vendor claims.

## P1/P2 continuation — 2026-11-12

- **Marp CLI (P1):** added an isolated `@marp-team/marp-cli@4.5.1` worker and local adapter. Synthetic Markdown exported to HTML and PPTX; the PPTX contains 2 slides, 0 editable text runs, and 3 media objects, so it is explicitly classified as rasterized. The two pages were rendered with PowerPoint 16.0 and Poppler and visually inspected. No external service was called.
- **Presenton (P2):** added a loopback-only v1 REST adapter with bounded input/output handling, explicit per-run provider-usage opt-in, and mocked request/OOXML validation. Its contract smoke test passed without contacting a service. Docker is unavailable on this host and Ollama has no installed models; no Presenton deck, provider cost, or generated-deck editability is verified. This supersedes the earlier “no adapter” boundary, but not the “service blocked” result.
- **Full repository check:** `npm run check` passed on Windows, including 167/167 tests, dependency inspection, evaluation, benchmark update, synthetic imports, validation, PPTX builds, QA, dual-profile build, and critique. `npm run render:marp` and the focused Marp/Presenton adapter tests also passed.
- **Acceptance boundary:** this is a completed, verifiable P1/P2 implementation slice, not completion of the full P1 or P2 tranches. Remaining P1 work is listed in `INTEGRATION_STATUS.md`; remaining P2 service and agent-host trials require a working supported runtime and an explicitly approved local model/provider. No paid or cloud generation was performed.

## Matplotlib P1 continuation — 2026-11-12

- Installed the isolated Matplotlib 3.10.8 worker in a Python 3.12.7 venv; transitive versions are pinned in `workers/matplotlib/requirements.lock.txt`. No global Python packages were changed.
- `npm run tools -- tools doctor matplotlib` and the real worker smoke passed. The line-chart fixture mapped 5 input observations and `E_SYN_01` exactly to deterministic SVG/PNG artifacts with SHA-256 manifests; evidence stayed unverified.
- `npm run render:matplotlib -- --out outputs/matplotlib-synthetic-reviewed` produced `outputs/matplotlib-synthetic-reviewed/matplotlib-synthetic.pptx`; OOXML QA: 1 slide, 1 text-editable slide, 0 native charts. PowerPoint 16.0 and Poppler rendered the page; the visual check found the chart title, synthetic warning and evidence status fit and remain readable. The SVG remains a picture object.
- `npm run check` passed end to end with 172/172 tests, then completed the benchmark, synthetic import, validation, PPTX build/QA, dual-profile build and critique steps.
- This is another P1 integration slice. PyMuPDF, Graphviz/D2, Quarto, LibreOffice, template/POTX import and broader existing-deck object edits remain incomplete. P2 service/agent E2E remains incomplete.
