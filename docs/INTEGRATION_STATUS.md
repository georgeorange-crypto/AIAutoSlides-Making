# Integration Status — P1 local workflow tranche

## Phase-1 continuation update — 2026-11-12

The former “Next phase” statement below predates the current IR adapter slice. `packages/core/` now contains project/profile/source/evidence/asset/claim/slide/deck/job constructors and semantic Presentation IR validation. Versioned JSON schemas cover presentation, source/evidence, project/profile, job and run-manifest objects. `packages/adapters/pptxgenjs-ir.mjs` and `src/render-ir.mjs` run the validated IR → PptxGenJS → PPTX QA path, preserve source verification state and IDs, and write lineage and run manifests. The local synthetic fixture produces a 3-slide deck with one native chart whose values match exactly. Legacy storyboard CLI remains unchanged.

This is an implemented vertical slice, not the complete Phase 1: no SQLite persistence, durable workflow engine, HTTP API/MCP, source-file staging service, incremental IR slide edit, comprehensive asset geometry, or full second-engine parity is claimed. Slidev remains a separate local IR/export route with SVG/image fallback limitations.

## Local automated follow-on — 2026-11-12

- `ToolAdapter.run()` for `pptxgenjs` now delegates to the validated Presentation IR rendering pipeline, which produces an editable PPTX and source/QA/run-manifest sidecars. The legacy CLI stays supported.
- Presentation IR image elements now embed workspace-local PNG/JPEG/SVG assets with checked type, SHA-256 and workspace/symlink boundaries. Rights state and source lineage are carried into sidecars; restricted rights block embedding, while unreviewed rights/license metadata stays a visible warning. No network asset fetch is performed.
- External HTTP/MCP APIs, cloud authorization, human blind-rating, human repair-time measurement, and scientific claim verification are outside this local automated slice by the current user instruction.

Date: 2026-11-12. Current checkout is `dev`; this section supersedes the historical P0 status below.

## P1 slice implemented and verified

- Added a fully local PDF.js + CSV + architecture JSON route that produces a source-linked storyboard/evidence ledger, native editable PPTX, OOXML QA, PDF/PNG previews, and SHA-256 run manifest. The checked-in PDF fixture and CSV values are explicitly synthetic; all evidence remains unverified.
- Added a local PDF.js adapter with doctor/smoke test, page locators and hashes; unlabeled CSV requires explicit local-input opt-in and remains verification-pending.
- Added preview renderer metadata/page hashes and native shape bounds/overlap checks. Cover decoration and architecture connectors stay in slide bounds. Visual review remains a separate human decision gate.
- Verified on Windows with `pdfjs-dist@5.4.624`, PowerPoint 16.0 COM, and Poppler `pdftoppm 26.07.0`. The 10-page result was rendered and every page visually inspected. No paid API or external upload was used.
- `npm test`: 74/74 passed. `npm run check`: passed end to end. `npm run validate` and `npm run build`: passed with the existing three warnings (missing chart sample size and two unverified example evidence entries).
- Full workflow command: `npm run workflow:research`. Artifacts: `outputs/research-workflow/research-workflow.pptx`, `.pdf`, ten `research-workflow-page-*.png` files, `.qa.json`, `.evidence-manifest.json`, `.preview.json`, and `run-manifest.json`.
- Added a separate `modify-existing` text-only route: `npm run fixture:existing-pptx` and `npm run workflow:existing-pptx -- --input ... --request ... --out ...`. A three-slide synthetic deck verified exact edit targeting, source immutability, unchanged slide OOXML hashes, retained native chart parts, and identical PowerPoint-rendered PNG hashes for untouched pages 1 and 3. The changed page was visually inspected. `pptx-automizer` itself remains catalogued, not integrated.
- In the current shared worktree, `npm test` and the full `npm run check` both passed with 85 tests. This count includes concurrent uncommitted tests outside this selective-edit commit.

## Remaining P1 work

The P1 ecosystem tranche is not complete. Since this historical status was written, local PDF/DOCX, Docling and MarkItDown extraction, Mermaid, Slidev, Marp, and Matplotlib have verified executable routes. Remaining named integrations include PyMuPDF, Graphviz/D2, Quarto, and LibreOffice; template/POTX import and `pptx-automizer` are also outstanding. Existing-deck editing remains limited to exact text in one OOXML run; chart/image/master/note edits, arbitrary template preservation, vendor extension fidelity, and layout repair remain unverified. See the dated continuations below for current evidence boundaries.

## P1/P2 continuation — 2026-11-12

### P1: Marp CLI adapter

- Added isolated `workers/marp/` package, pinned to `@marp-team/marp-cli@4.5.1`, a local adapter, `doctor` / `test` registration, a runnable synthetic fixture, and `npm run render:marp`.
- The adapter exports HTML/PDF/PPTX from local Markdown, rejects remote/data/file media references and active HTML, prevents output overwrite, hashes inputs/outputs, and can carry a provided source-lineage sidecar. It does not enable Marp's unsafe local-file mode.
- Real Windows smoke and fixture export passed. The Marp PPTX had 2 slides, 0 editable text runs, and 3 media objects; the manifest correctly marks its default pages as rasterized. PowerPoint 16.0 + Poppler rendered the two pages, both visually inspected.
- Marp's experimental `--pptx-editable` path is not enabled here because LibreOffice is absent; it has known output-fidelity tradeoffs and is not claimed as tested.

### P2: Presenton self-hosted API contract

- Added a Presenton v1 adapter path with offline doctor, mocked request-contract smoke test, loopback-only service URL, bearer-key handling without logging, bounded slide/output sizes, explicit `allowProviderUsage` per run, disabled web search, and same-origin PPTX download validation.
- The adapter contract tests pass without contacting a service. This is **adapter-ready / contract-tested**, not service E2E: no Presenton service is running, Docker is unavailable on PATH, and local Ollama has no installed models in this environment. A generated deck, actual provider cost, and editability have not been verified.
- slide-maker, PPT Master, and PPTAgent still have no executable end-to-end route in this phase. Their upstream Skill/CLI flows need supported host/runtime and model-provider readiness. No external or paid model call was made.

### Checks and next acceptance work

- Focused adapter suite: Marp real HTML+PPTX E2E and Presenton contract tests passed.
- Continue P1 with isolated PyMuPDF / Graphviz or D2 / Quarto / LibreOffice routes and stronger existing-template editing. Continue P2 by bringing up an approved local Presenton + model runtime, then evaluate the three host-agent tools in disposable profiles without recursive author-agent calls.

### P1: Matplotlib scientific figure worker

- Added a Python 3.12 virtual-environment installer and pinned Matplotlib 3.10.8 worker. The worker accepts bounded JSON for line/bar/scatter/CDF figures, requires source IDs, checks numeric shapes and CDF monotonicity, and emits deterministic SVG/PNG plus input/evidence/output hashes.
- Registered `doctor` / `test` and a runnable synthetic example. `npm run render:matplotlib` produced an actual 1-slide PPTX with the SVG as a vector picture object; native title/status text, source IDs and pending verification are retained in notes and sidecar manifests.
- Windows runtime: Python 3.12.7, Matplotlib 3.10.8. PowerPoint 16.0 + Poppler rendered the PPTX and its page was visually inspected. `src/qa.mjs` reported 1 slide, 1 text-editable slide, 0 native charts. No empirical data or external APIs were used.
- This does not meet native chart-object editability. The Python transitive dependency and bundled-font license closure remains under review.

### P1: PyMuPDF local PDF extraction worker

- Added an isolated Python worker pinned to PyMuPDF 2.1, `doctor` / `test` registration, and a synthetic-paper fixture. The adapter checks input scope, task IDs, worker version, source hash, artifact paths and SHA-256 values; output includes page text/locators, selected PNG previews, raster image extraction with bounding boxes, vector drawing bounds, and source/evidence sidecars.
- Resource bounds: PDF ≤100 MiB and ≤500 pages; text ≤20 million characters total / 1 million per page; previews ≤20 pages and 25 million pixels per page; embedded images ≤100, ≤25 million pixels each and ≤50 MiB total; vector records ≤2,000 per page. OCR is not run.
- The fixture is synthetic. Extracted evidence remains `verified:false`; the run records source hash and OCR status. Embedded-image extraction does not grant reuse rights.
- The official PyMuPDF documentation describes PyMuPDF/MuPDF as dual licensed under GNU AGPL and Artifex commercial terms. This repository has not selected a distribution license path; catalog status remains `needs-review`, so the optional worker is not a default dependency. The environment's local installation and fixture run do not resolve that license gate.
- Verification: `npm run deps:pymupdf` installed PyMuPDF 2.1 in the isolated Python 3.12.7 environment; rerunning it against the generated exact-version dependency lock passed. `npm run tools -- tools doctor pymupdf`, `npm run tools -- tools test pymupdf`, and `npm run import:pymupdf` passed locally. The focused PyMuPDF suite passed 3/3, including path/task rejection and a synthetic raster-image + vector-coordinate extraction. The produced `page-0001.png` was opened and visually inspected; it displays the synthetic PDF text with no apparent render corruption. `npm run check` passed with 176/176 tests and the full legacy build/QA/benchmark chain. Existing unverified-source and sample-size warnings remain expected.
- Synthetic run output is local and ignored under `outputs/pymupdf-synthetic/`; no research or private files were used. PyMuPDF is now `e2e-tested` for this local extraction capability only; the AGPL/commercial distribution gate remains unresolved.

---

# Historical P0 registry tranche

Date: 2026-11-12. Scope: remote/worktree audit, candidate registry, adapter protocol, CLI discovery and IR contract/migration scaffold.

## Repository audit

- Checkout: `dev` at `ef29168`, one commit ahead of `origin/dev` at audit time. Existing user changes/untracked files were preserved.
- Local and remote `main`: both `444ae66` (`Initial evidence-first slides engine`); remote `dev`: `6074438` (`Add offline PDF.js document import fallback`). This is a read-only `git ls-remote` comparison, not a fetch or claim that the remote repository is otherwise healthy.
- The Q&A capability inventory substantially matches the existing code and reports limits clearly. It predates this registry and does not claim Tool Matrix/Workflow V2 exists.
- Existing PptxGenJS build, CSV importers, PDF/DOCX text extraction, evidence checks, and optional Slidev comparison are distinct legacy paths. Registry membership does not retrofit them to the new orchestration protocol.

## Implemented in this tranche

- 52 catalog entries under `registry/catalog/` with license review state, platform, interface, I/O, runtime, network/auth/cost and editability metadata. Unpinned/upstream values are marked unknown or needs-review. PptxGenJS is `smoke-tested`; other entries are `catalogued`.
- Versioned Source/Evidence IR, Presentation IR and Run Manifest JSON Schemas plus migration helpers for legacy evidence/storyboards.
- `ToolAdapter` contract and PptxGenJS dependency/capability adapter. The adapter reports its current raw `run()` limitation rather than pretending to provide full IR rendering.
- `ai4slides tools list`, `doctor`, and `test <id>`; missing integrations get an actionable blocked result, and external endpoints are not contacted.
- Formal routing specs for six requested workflows and this status/architecture/QA/dependency documentation.

## Verification actually completed in this checkout

- `npm test`: passed, 69 tests in the latest shared-worktree run (six additional M3A tests were uncommitted at that point) (including catalog, CLI, artifact smoke, schema, migration, Google OAuth mock and existing diagram/validation tests).
- `npm run validate`: passed for the 7-slide research example; retained three warnings (two evidence sources unverified, chart sample size missing).
- `npm run build`: passed, created `outputs/research-demo.pptx` and review/lineage reports.
- `npm run check`: passed end to end with 69/69 shared-worktree tests, including dependency inspection (`pptxgenjs@4.0.1`, `fflate@0.8.3`, `pdfjs-dist@5.4.624`), existing import/build/QA/critic/benchmark workflows, synthetic charts and repeated-run fixture.
- `npm exec ai4slides -- tools list`: listed all 52 entries. `tools doctor pptxgenjs` found PptxGenJS 4.0.1; `tools test pptxgenjs` creates a temporary two-slide PPTX, checks OOXML slide and native chart parts, then removes it. `tools doctor docling` correctly reported blocked because its executable is unavailable and no adapter is implemented.
- `npm run preview`: produced a 7-page PDF and seven 1600×900 PNG previews using the Windows PowerPoint COM path and bundled `pdftoppm`. Every page was visually inspected. No apparent clipping/overlap was found; slide 4's full-request title and plot fit, while source verification remains unresolved as reported by the deck.
- Cost/network: no external APIs were called; no source material was uploaded.

## Not completed

No new PDF+CSV end-to-end workflow, Docling/MarkItDown/Mermaid/Matplotlib adapters, existing-PPTX edit route, authenticated SaaS deck creation/edit integration, visual repair loop, or fixture-backed multi-backend workflow is claimed. A loopback Google OAuth test page and mocked read-only API contract tests are present, but real account consent/API access is not verified. The broad catalogue has not had all upstream license/API versions re-audited. PptxGenJS has an artifact-producing smoke test, but its `ToolAdapter.run()` and Presentation IR route remain incomplete; no `e2e-tested` status is claimed.

Next phase: connect legacy render/build through the adapter request contract without changing legacy commands, add semantic validation of the three IR schemas and migrations, then add one isolated local tool adapter at a time. A PDF+CSV→PPTX→PDF/PNG route needs available local render dependencies and page-by-page inspection.

## Authorization and workflow choice update

- `src/google-oauth.mjs` adds an actual local Google OAuth consent test using PKCE and a loopback-only HTTP server. Its flows are identity-only or identity plus `presentations.readonly`; an explicitly entered existing presentation ID can be read for title and slide count. No create/edit/upload endpoint is implemented; access tokens are kept only in process memory.
- Tests inject fake token, user-info, and Slides API responses. They validate PKCE, local routes, scope-gated metadata access, and rejection of a foreign Origin without contacting Google. This verifies the local code paths, **not** real Google account consent. `npm run connect:google` requires the user's own Desktop OAuth client JSON in `GOOGLE_OAUTH_CLIENT_FILE`.
- `tools recommend <workflow>` returns stage-specific primary and alternative candidates for research, pitch, modifying decks, data updates, HTML decks, and multi-engine comparison. It states runtime, network/auth/cost/editability and known trade-offs; it never installs or invokes options.
- Integration truth remains bounded: Google OAuth is ready for user-configured local testing, not end-to-end verified; PptxGenJS smoke test writes/inspects a temporary native-chart deck, while unified Presentation IR `run()` is still pending; the rest remain catalogued/probed candidates.
- OSS selection rule: prefer an existing local component when format and fidelity fit; retain alternatives where they offer different output/editability/workflow. Do not bundle or copy templates/assets; verify each upstream license/version and dependencies before adoption. The 52-entry license audit remains incomplete (`needs-review`).
