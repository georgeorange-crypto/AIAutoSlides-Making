# Implementation status — current roadmap snapshot (2026-11-13)

This top-level section supersedes older phase summaries below where they describe current work as planned or absent. Historical dated sections are retained as records of earlier verification snapshots.

## Current phase status

| Phase / item | Status | Evidence and remaining gate |
|---|---|---|
| Phase 0 — baseline and candidate bakeoff | **partial / incomplete** | PptxGenJS, Slidev and deterministic PPTAgent HTML conversion produced reviewed decks. Presenton local service/API smoke passed but generation failed because its configured Ollama model is absent. slide-maker and SlidePoise remain unrun. None of the three required matched task groups has been evaluated across candidates. See `docs/POC_RESULTS.md`. |
| Phase 1 — IR, adapters, workflow and local API | **implemented / tested** | Versioned IR, PptxGenJS and Slidev paths, SQLite-backed loopback API, durable jobs, edits, artifacts and review state are present. Single-user, single-process limitations remain. |
| Phase 2 — research/document/media | **bounded slice implemented / tested** | Opt-in metadata search, selected arXiv PDF download/local extraction, imported local PDF/DOCX extraction with optional durable Docling or MarkItDown, operator-authorized single-page Crawl4AI, and selected Commons image download are durable REST/MCP jobs. No automatic scientific verification, bulk acquisition, or multi-stage durable research DAG. |
| Phase 3 — Presentation Intelligence + Critic | **bounded deterministic slice implemented in this revision** | Audience-aware narrative roles, per-slide evidence/media candidates/time allocation are produced from IR. The formal Harness full-deck path blocks missing/incomplete agendas, missing or misnamed section transitions, unassigned content, overly thin transition copy, rendered bounds/overlap/small-type errors, missing renders, thin visible explanations, materialized visual coverage below a non-lowerable 50% content-page floor, repeated composition signatures, assistant-facing text, long English blocks in Chinese decks, and per-priority standard/deep core-page allocations (schema 1.2.0; standard >=2 pages, deep >=7). Representative pilots defer whole-deck structure checks. Semantic support, image relevance, aesthetic judgment, selection of appropriate topic depth, verification of facts and human approval remain outside automation. |
| Phase 4 — App + MCP + QA | **local API/MCP slice implemented; desktop UI blocked behind Phase 0 decision** | Loopback REST + stdio MCP expose project, source, profile, slide, plan, critique, render, job, artifact listing/export, scholarly metadata search, selected arXiv/document ingestion, explicitly authorized one-page crawl, and one selected Commons image download. Local-only preference profiles can seed new projects. No Windows GUI/installer, authenticated remote API or Android client. UI choice remains gated on Phase 0 evidence. |
| Cross-cutting IR/editability | **partial** | The PptxGenJS adapter converts a bounded acyclic Mermaid flowchart subset into editable PowerPoint shapes/connectors and visibly falls back to source text for unsupported syntax. Full Mermaid coverage is not claimed. Re-render still rebuilds the full deck; unchanged-slide output hash preservation is not guaranteed. |
| Cross-cutting license audit | **partial / release gate** | Direct licenses and integration postures are recorded. The transitive npm inventory and local artifact/model/font/template notices still require coverage and legal review before redistribution. |

## This revision's evidence

- Added deterministic audience-specific narrative roles and per-slide takeaway, evidence references, media candidates/selection reason, and duration allocation to the Presentation IR workflow and local API.
- Added a deterministic, local Mermaid flowchart subset converter for native editable PowerPoint shapes/connectors. It preserves Mermaid source in notes, validates shape types, rejects cycles/unsupported constructs and falls back to editable text with a warning; exact limits and test evidence are in [`M14_NATIVE_MERMAID_FLOWCHART_REPORT.md`](M14_NATIVE_MERMAID_FLOWCHART_REPORT.md).
- Local profile language, tone and slide-density preferences now flow into the deterministic content-plan report. Explicit Presentation IR metadata overrides profile defaults; these values remain authoring guidance and do not cause deterministic translation or text rewriting.
- Added local rendered-page OCR coverage screening for Critic output, together with OOXML per-slide bounds, overlap, text-size, editability, table/chart and chart-value results. Preview-disabled jobs explicitly report `not_rendered`; OCR initialization/page failures degrade to `unavailable`/`partial` without discarding a successful deck; image checks do not imply visual approval or scientific verification.
- Wired a formal-deck hard quality gate into the Harness Critic and visual approval path. A deck plan cannot lower materialized-visual coverage below 50% of content pages; the audit applies the floor independently. The approved plan sets a minimum structured-visual share and minimum visible explanation length; final OOXML QA/render data checks those limits and blocks approval on missing pages, out-of-bounds/overlapping text, non-footer text below 14 pt, assistant-to-user phrases, long English-only blocks in Chinese decks, body-text occupancy below 4.5% on visual pages or 6% on text-only pages, fewer than two body-text lines, five consecutive matching compositions, and low full-deck layout diversity. Negative fixtures prove each rule and the API rejects approval when the gate fails. Layout signatures use slide structure plus coarse rendered object distribution where available; they ignore the plan's self-reported layout names. This is a deterministic screening gate, not an aesthetic or scientific correctness guarantee.
- Formal deck plans now require an agenda listing all narrative sections, one ordered transition per section, and a section assignment for every content page. The full-deck quality gate checks those labels against the IR and requires each section transition to contain at least 18 visible text units beyond its heading; pilot subsets defer this full-deck check. Adversarial tests cover missing agendas/transitions, unassigned content, sparse transitions, and pilot deferral. A seven-slide synthetic PowerPoint 16.0 run had zero blockers; OCR coverage left one page warning for human inspection. Details and reproducible command are in [`QUALITY_NARRATIVE_STRUCTURE_REPORT.md`](QUALITY_NARRATIVE_STRUCTURE_REPORT.md). This does not determine whether the story is logically sound or well-proportioned.
- Added read-only REST/MCP `plan_deck` and `critique_deck` operations. MCP remains stdio and requires the local API to be started separately.
- Added read-only MCP `aiautoslides_export_deck`, which locates the newest PPTX artifact and returns its SHA-256 plus the existing loopback download route; it does not start a render or embed deck bytes.
- Added project-scoped REST/MCP scholarly metadata `research_topic`; outbound calls require `allow_network: true`, persist provider records as unverified source candidates with record hashes and locators, and do not download full text or create evidence excerpts. Repeat imports are idempotent for matching record hashes. API/MCP regression coverage injects a local fake searcher; no public provider was contacted during verification.
- Added `POST /projects/{id}/research/jobs` and MCP `aiautoslides_enqueue_research` to queue scholarly metadata searches with durable job status, stage events, restart policy, cancellation and project-source persistence; it is a single search stage and does not imply a research DAG.
- Added `POST /projects/{id}/research/papers` and MCP `aiautoslides_enqueue_arxiv_ingest` for one explicitly selected arXiv candidate. A durable job downloads an allowlisted PDF (50 MiB maximum), extracts text locally with PDF.js, persists the source PDF by SHA-256, attaches page-located excerpts as pending evidence, and records four job artifacts. Cancellation applies through the download and at extraction boundaries. Scientific verification and paper reuse rights stay pending human review; no public PDF was downloaded during tests.
- Added `POST /projects/{id}/research/documents` and MCP `aiautoslides_enqueue_document_ingest` for a previously imported PDF or DOCX. A durable local job verifies the content-addressed source, extracts selectable PDF text or DOCX body paragraphs, attaches page/paragraph excerpts as pending evidence and records Markdown/manifest/evidence artifacts. No network call or OCR is made. Fixed a synchronous-worker registration race discovered by the DOCX job, which could otherwise leave `waitForIdle()` spinning after a fast job.
- Added `POST /projects/{id}/research/pages` and MCP `aiautoslides_enqueue_page_crawl` for one operator-authorized HTTPS page. A durable async sidecar job enforces public DNS/IP and same-host redirect rules, requires Crawl4AI's robots confirmation, stores page Markdown by hash, and attaches excerpts as pending evidence with manifest/evidence artifacts. Automated tests use a synthetic worker; no web page was fetched. Terms and reuse rights remain a human review gate.
- Extended the durable local document job with optional `engine:"docling"` and `engine:"markitdown"`; PDF.js remains the default for selectable-text PDFs and the built-in DOCX path remains the default for Word files. Docling model downloads stay disabled unless separately requested with `allow_model_download:true`. Both optional parser outputs are source-hash checked and remain pending human verification; MarkItDown runs in a cancellable asynchronous child process and reports document-level locators only.
- DOCX extraction now includes only header/footer parts referenced by the document's section relationships, with part-specific locators after body paragraphs. External, orphaned, and path-escaping relationship targets are excluded; extracted text remains unverified.
- Added a durable one-selected-item Wikimedia Commons download job through REST/MCP. It requires both network/download opt-ins, accepts only HTTPS Wikimedia raster-host URLs and PNG/JPEG bytes, stores the file by project-local content hash, and attaches unverified source/asset records with `rights_status:"pending"`; license and attribution review are still required. Automated verification used an injected local image, with no Commons request.
- Extended the local DOCX parser to extract body text plus header/footer XML parts referenced by document section relationships. Source locators identify the header/footer part and its paragraph; external and unreferenced parts are ignored.
- `scripts/run-tests.mjs` now runs test files serially (`--test-concurrency=1`) to prevent local rendering/OCR integration tests from contending for CPU and timing out under the previous file-level parallel execution.
- Added regression coverage for URL policy and mapped egress, redirect constraints, worker timeout/cancellation, robots confirmation, and durable REST/MCP authorization; the crawl helper/API tests use injected fake responses and never contact an external page.
- Added SQLite-backed local preference profiles through REST and MCP (`GET/POST /profiles`, `GET/PATCH /profiles/{id}`). New projects can select a profile; audience, duration and theme are defaults only, preserving explicit IR values. Profiles cannot enable network or paid API use.
- Fixed the optional AI planner's review sidecar to serialize the computed Critic report, and extracted record construction into a unit-testable helper. The network-backed AI planner was not invoked.
- Added regression coverage for same-IR audience differentiation, evidence/media/time planning, rendered-image OCR screen behavior, API/MCP planning and critique, and AI review record serialization.
- Verification after selected arXiv and local document job changes: `node --test --test-concurrency=1 tests/api.test.mjs tests/mcp.test.mjs tests/document-import.test.mjs` **22/22 passed**; `npm run test` **172/172 passed**. `npm run validate` passed with three disclosed warnings (missing chart sample size; E1/E2 unverified); `npm run build` passed; `node src/qa.mjs outputs/research-demo.pptx` passed with 7/7 text-editable slides and one native chart; `npm run preview` passed using PowerPoint 16.0 and Poppler 26.07.0 and rendered seven pages. All seven pages were directly inspected; no clipping/overlap found. This visual inspection is not scientific verification or formal approval.
- Workflow integration smoke: Presentation IR fixture completed all workflow stages with preview enabled, produced 3 PNGs, and wrote `workflow.critique.json`. OCR screen status was `review` (one page low text coverage); `scientific_accuracy=not_assessed` and `visual_review=pending_human` remained intact. The temporary smoke artifacts were removed after inspecting the report.
- See the final verification record below for commands actually run on this revision. No external candidate installation, paid call, user-source upload, remote authentication, legal approval, or human visual sign-off is claimed.

### Latest verification — durable document, Commons image, and page ingestion

- `node --test --test-concurrency=1 tests/api.test.mjs tests/mcp.test.mjs tests/wikimedia-commons.test.mjs`: **18/18 passed** after Commons API/MCP integration.
- `npm run test`: **180/180 passed** with the repository test runner executing files serially.
- `npm run validate`: passed with three disclosed warnings: missing chart sample size and E1/E2 unverified.
- `npm run build`: passed; `node src/qa.mjs outputs/research-demo.pptx` reported 7 slides, all text-editable, and one native chart.
- `npm run preview`: passed with PowerPoint 16.0 and Poppler 26.07.0; seven pages rendered and all seven PNGs were directly inspected. No clipping or overlap was apparent. This is visual inspection, not scientific verification or formal human approval.
- Offline Docling CLI smoke used the already installed Python 3.12.7 / Docling 2.150.0 runtime via `AIAUTOSLIDES_PYTHON` and the generated seven-page demo PDF; it produced 30 page/element blocks. Model downloads were not enabled, and all excerpts remain pending review. The API's durable Docling integration was exercised with a synthetic injected worker, not by re-running the multi-minute parser through HTTP.
- MarkItDown 0.1.9 `runAsync` parsed the synthetic local PDF through the already installed isolated worker; it returned 234 Markdown characters, the source byte count/hash, and `unverified` status. The durable API job and MCP schema were verified with an injected worker; the API route was not re-run against the multi-minute real parser.
- Commons API integration used an injected local PNG result; it saved the verified image hash and pending-rights asset/source into the project without contacting Wikimedia. The real Commons helper's host/type constraints remain covered by offline unit tests.
- No real webpage or Commons image was fetched in this verification. No paid API, external candidate install, user-source upload, legal review, or human content/rights sign-off was performed.

## Phase 1 deliverables

### Implemented

- `packages/core` defines Project, UserProfile, Source, Evidence, Asset, Claim, SlideIR, DeckIR, JobState, safe slide-IR patches, semantic validation and legacy storyboard/evidence migration. Project, job, source/evidence, run-manifest and presentation contracts are versioned JSON Schemas.
- `packages/adapters` has a versioned PresentationAdapter contract with required `probe`, `capabilities`, `render`, `edit`, `export` and `cancel` operations. PptxGenJS IR supports validated slide patches, native editable PPTX generation, lineage/QA/run manifests, immutable artifact export and explicit stage-boundary cancellation limits. Slidev remains a tested secondary rendering engine with documented SVG/chart/editability limits.
- `packages/workflow` implements local IR import/validation, supplied-evidence inventory, deterministic content and visual plans, capability negotiation, PPTX generation, structural QA, optional PDF/PNG preview, human-review gating, export, JSONL events and a durable run report. Network research is explicitly disabled in this workflow; inventory never verifies facts.
- `packages/api` provides a loopback-only REST API for projects, incoming source files, slides/IR edits, jobs/status/cancel, artifacts and downloads. SQLite stores project revisions, source metadata, slide snapshots, job states/events and artifact hashes. Raw imported source bytes are immutable and stored at `source-blobs/<sha256>`; downloads verify hashes.
- Restart handling requeues persisted queued jobs and marks interrupted running jobs failed with an explanation. Preview is optional per job. PptxGenJS in-process rendering is not hard-cancellable; cancellation is honored between workflow stages.
- The legacy CLI remains supported. The API requires Node.js 22.5+ for built-in `node:sqlite`; the legacy CLI retains the package's declared minimum runtime.

### Tested

- `npm run test`: **exit 0; 116/116 passed, 0 failed**.
- `npm run validate`: **exit 0**; legacy 7-slide research example passed with three explicit warnings (missing chart sample size; E1/E2 unverified).
- `npm run build`: **exit 0**; legacy 7-slide deck and review report generated.
- `npm run preview`: **exit 0**; PowerPoint 16.0 plus pdftoppm rendered 7 PNG pages; all 7 visually inspected with no apparent clipping/overlap.
- `npm run api -- --help`: **exit 0**; API command help returned successfully.
- API default-preview end-to-end: **exit 0**; local project and job traversed all 8 workflow stages, generated PPTX/PDF/3 PNG pages, QA, lineage, export copies and JSONL logs (21 artifact records). All 3 API-run PNG pages were visually inspected. The input, deck, previews, reports and SHA-256 manifest are preserved in `artifacts/phase1-api-e2e/`. Job ID: `f9b72ea9-d0bf-4988-8aea-16bd953e6ce2`; native PPTX SHA-256: `3610b1a7bbecd27393da6b0168a413e5beed7afaf8708f01a38bc30e7a848029`.
- `node --test tests/api.test.mjs tests/presentation-ir.test.mjs`: targeted API/IR suite passed; these tests are included in the 116-test full run.
- API integration covers project persistence, content-addressed source import, path boundary rejection, slide patch validation, job rendering, export/download hash verification, queued-job recovery and interrupted-job failure handling.
- PptxGenJS IR end-to-end smoke test passes with native chart/value parity; source verification warnings remain visible. Slidev's separate successful local export and limitations are documented in `docs/SLIDEV_ADAPTER.md` and `docs/TOOL_MATRIX.md`.
- Legacy example and IR deck have previously passed validation/build, OOXML QA and PowerPoint→PDF→PNG rendering with all pages visually inspected. The current final render will be recorded after this revision's full verification.

### Demo-only and not claimed

- Research/evidence stage only inventories caller-supplied evidence. It does not crawl, retrieve papers, extract new claims or make scientific verification decisions.
- Content and visual plans are deterministic summaries of supplied IR, not AI-generated audience/narrative/media optimization.
- Critic stage reports structural/data QA and sets scientific accuracy to `not_assessed`; visual approval remains `pending_human` after preview.
- Slide patch changes the versioned IR. Re-render rebuilds the deck; unchanged slide output hashes are not guaranteed.
- The REST API is local, single-user and single-process. It is not authenticated for remote access, sandboxed at the OS level, or suitable for reverse-proxy exposure.

## Phase 1 exit checks

- Versioned IR contracts and migration: implemented.
- PptxGenJS adapter and a successfully run secondary engine: implemented/tested.
- Import→evidence inventory→content/visual plan→generation→preview→critic→export workflow with durable status/logging: implemented locally.
- REST project/job/artifact/slides/edit endpoints and SQLite persistence: implemented locally.
- Native editable PPTX, source lineage, QA, hashes, screenshots and human-review state: generated as local reproducible artifacts; scientific verification remains separate.

## Remaining work after this revision

- Phase 0 bakeoff remains incomplete: no matched runs for academic source study, commercial market report, or six-slide reference recreation; Presenton generation is blocked on a locally available model; slide-maker and SlidePoise have not run in an Agent host. See `docs/POC_RESULTS.md`.
- Phase 2 research integrations include opt-in OpenAlex/Crossref/arXiv metadata search, local Docling and MarkItDown extraction, one-page Crawl4AI, selected arXiv PDF download and a one-item Wikimedia Commons asset workflow. Durable REST/MCP jobs cover metadata search, arXiv PDF, imported PDF/DOCX extraction (PDF.js/DOCX default, Docling or MarkItDown selectable), authorized one-page Crawl4AI, and one selected Commons download. Extracted claims and asset reuse remain pending human review.
- Phase 3 deterministic planning and OCR/OOXML screening are implemented; content value selection, argument entailment, aesthetic review, media search and real-time presentation timing remain unimplemented.
- Phase 4 local stdio MCP server over the loopback API includes `research_topic`, selected arXiv ingestion, local PDF/DOCX extraction (optional Docling), authorized one-page crawl, and `export_deck` (PPTX route + hash); outbound operations require opt-in. Windows UI/installer, remote auth/scopes and Android remain planned and are gated on the Phase 0 product decision.
- Preference profiles are exposed via REST/MCP but do not synchronize across machines. Audience, duration and theme seed project defaults; language, tone and slide density are surfaced in the content plan as guidance, but do not automatically translate or rewrite slide content.

- Phase 0 bakeoff is incomplete for some requested engines/task groups; blocked and unrun candidates remain identified in `docs/POC_RESULTS.md`.
- Phase 2 research integrations are implemented for opt-in OpenAlex/Crossref/arXiv metadata search through CLI, local REST and stdio MCP, including project-scoped candidate persistence, explicit unverified source registration, pending evidence excerpts, and caller-supplied excerpt review records. Local exact-source matching covers supported text, selectable PDF and DOCX content; these matches do not assess entailment. Local Docling and MarkItDown extraction, single-page Crawl4AI, selected arXiv PDF download, and a Wikimedia Commons workflow for one item or a bounded selection of up to five images remain CLI/local-worker routes. Extracted claims and asset reuse remain pending human review.
- Phase 3 audience/narrative/media intelligence and rendered-image critic remain planned.
- Phase 4 local stdio MCP server over the loopback API is implemented; full UI, remote auth/scopes and Android remain planned.
- Full Presentation IR element coverage, native Mermaid shape rendering and unchanged-slide hash preservation remain incomplete.
- Transitive dependency, model and media-license audit remains incomplete.

## Phase 2 research, document and asset workflows — 2026-11-12

- Implemented: opt-in OpenAlex/Crossref/arXiv metadata search via CLI, loopback REST and stdio MCP; project-scoped search candidate persistence and explicit source registration; API/MCP insertion of user-supplied exact evidence excerpts in pending state; local Docling and MarkItDown extraction; single-page Crawl4AI with robots check, same-host requests and URL/IP safeguards; selected single-paper arXiv PDF download; and separately selected one-to-five-item Wikimedia Commons media retrieval. Commands and safety boundaries are documented in `docs/PHASE2_RESEARCH_SEARCH.md` and `docs/API_WORKFLOW.md`.
- Retrieval and extraction artifacts include source identifiers, URLs or local locators, retrieval time, source/response/content hashes where applicable, and short excerpt candidates. Candidates remain unverified and asset rights remain pending human review.
- The existing local document importer also provides offline PDF OCR, DOCX body/header/footer image extraction and text extraction for section-referenced headers/footers, plus bounded PDF image-XObject and inline-image extraction with hashes and source locators. PDF masks/soft masks and uncommon sample formats remain unsupported.
- Search/download boundaries are explicit: network calls require opt-in; image search does not download files; only one selected arXiv paper or Commons image can be downloaded per command; web crawl does not traverse links or fetch media.

- The existing local document importer also provides offline PDF OCR, DOCX body/header/footer text and image extraction, and PDF inline-image/image-XObject extraction with hashes and source locators. PDF masks/soft masks, uncommon sample formats and DOCX comments/tracked-deletion semantics remain unsupported.
- Search/download boundaries are explicit: network calls require opt-in; image search does not download files; one selected arXiv paper or a selected Commons batch of at most five images can be downloaded per command; web crawl does not traverse links or fetch media.
- Docling 2.150.0 and Crawl4AI 0.9.5 are pinned in the isolated Python runtime. Docling model downloads are opt-in. Crawl4AI requires its locally installed Playwright Chromium. MarkItDown 0.1.9 uses its separate isolated worker.
- Phase 2 is complete for these bounded integration slices. The API can store caller-supplied human excerpt-review decisions but does not authenticate reviewer identity or assess semantic entailment. General DOI full-text resolution outside Europe PMC, unbounded media acquisition, MinerU integration/licensing, automated scientific verification and parser-accuracy evaluation remain planned or out of scope.
- The prior combined `npm run check` record on the PDF/DOCX asset and cover-layout update is exit 0 with 153/153 tests and the synthetic import/build/QA sequence. On the M12/PDF-DOCX revision, I separately reran the full suite: `npm run test` passed **157/157**; `npm run validate` and `npm run build` exited 0; `node src/qa.mjs outputs/research-demo.pptx` confirmed 7 editable slides and 1 native chart; `npm run preview` rendered seven pages using PowerPoint 16.0 and Poppler 26.07.0, and each page was visually inspected. One chart sample-size warning and two unverified evidence entries remain. The cover title wraps within the content column without intruding into the decorative panel; human design approval remains pending.

## Verification record

The verified Phase 1 snapshot was committed as `ee469885d864c217dae3947b892f48a6e6417228` (`Complete Phase 1 local workflow and project API`) and pushed to `origin/dev`; `git ls-remote` confirmed that exact ref. Additional working-tree edits appeared after that push and are outside this Phase 1 commit.

## Local adapter completion follow-on — 2026-11-12

- `pptxgenjsAdapter.run()` now calls the validated Presentation IR pipeline; output includes editable PPTX, exact chart QA, lineage, run manifest and evidence sidecars.
- Presentation IR image elements use position/alt text and a declared local asset. PptxGenJS checks MIME, SHA-256, 25 MB size, workspace containment, symlink paths and risky SVG markup. Rights state is never auto-approved.
- Slidev now has `runIR()` and `npm run render:slidev-ir`; it stages local image assets and renders PDF/PNG. A real 9-page synthetic PDF and nine PNGs were generated. Editable PPTX for the richer image/process fixture was stopped by QA after Slidev produced 0 editable-text slides.
- Automated local checks are rerunning. Human visual sign-off, scientific verification, real-source OCR accuracy review, blind human scores, manual repair timing and cloud/API account actions were explicitly skipped.

## Local Agent integration follow-on — 2026-11-12

- `src/mcp.mjs` exposes the loopback REST project workflow through stdio MCP. The API must be started separately; this server is not remote, authenticated or multi-user.
- One shared evidence-first presentation Skill is available to Codex at `.agents/skills/aiautoslides/` and Claude Code at `.claude/skills/aiautoslides/`; both are checked against `skills/aiautoslides/SKILL.md` by an automated test.
- The Skill uses local deterministic import, validate, build, structural QA and preview commands. It requires review of every rendered page and keeps scientific verification and human visual approval pending until performed.
- Optional AI planning and scholarly search remain separate opt-in network workflows. The Skill does not invoke them, and source evidence/metadata is never promoted to verified automatically.

## Local DOCX image extraction follow-on — 2026-11-12

- `src/document-assets.mjs` optionally extracts PNG/JPEG/SVG image parts referenced by DOCX body/header/footer; `src/pdf-assets.mjs` decodes PDF image XObjects to PNG. External DOCX relationships and paths outside `word/media/` are ignored; images are deduplicated by SHA-256 and bounded by per-image, aggregate-size, image-count and page-count limits.
- `node src/import-document.mjs --extract-images` writes copied assets and an `--assets`-compatible JSON manifest with document SHA-256, source part, relationship IDs, alt text when available, MIME type, and `verified:false` inherited rights state.
- Unit/integration coverage checks DOCX body/header/footer PNG/JPEG/SVG and PDF XObject/inline-image extraction, duplicate handling, exact hashes, manifest loading/slide association, embedded PPTX objects, and external/path-traversal rejection. DOCX header/footer text extraction is implemented for section-referenced parts.
- Detailed stage results: `docs/M9_DOCX_ASSET_EXTRACTION_REPORT.md`, `docs/M10_PDF_ASSET_EXTRACTION_REPORT.md`, `docs/M11_DOCX_HEADER_FOOTER_ASSETS_REPORT.md`, and `docs/M12_COVER_LAYOUT_CORRECTION_REPORT.md`.

## PDF inline-image extraction follow-on — 2026-11-12

- `src/pdf-assets.mjs` decodes supported PDF.js inline-image operators as bounded PNG assets alongside image XObjects. Grouped sprite payloads are cropped by their placement maps into independent PNG content before hashing and deduplication. Provenance includes source PDF hash, page, operator index/name, inline-image flag, placement index, and a hash of decoded source pixels; output rights remain inherited and `verified:false`.
- Synthetic coverage verifies a real inline-image PDF, repeated-placement deduplication and locator preservation, grouped-sprite crop pixels, and invalid crop rejection. `npm run test` passed **183/183**.
- `npm run validate` and `npm run build` exited 0 with the existing 3 warnings (chart sample size missing; E1 and E2 unverified). Deck QA confirmed 7 editable slides and 1 native chart. PowerPoint 16.0/Poppler 26.07.0 previewed all 7 pages; each was opened and visually reviewed with no apparent clipping. Human visual approval and source verification remain pending.
- Remaining PDF asset-extraction gaps: masks/soft masks, uncommon sample formats, vector drawing extraction, semantic matching, OCR-to-figure association, and human rights review.

## Profile preference planning follow-on — 2026-11-12

- Deterministic content-plan reports now carry local profile `language`, `tone`, and `slide_density` as authoring guidance; explicit Presentation IR metadata takes precedence. Planning does not translate or rewrite slide text.
- `npm run test` passed 184/184; `npm run validate`, `npm run build`, and `npm run preview` passed. PowerPoint 16.0/Poppler 26.07.0 rendered seven pages; all were opened and visually inspected without apparent clipping or overlap.
- See [`M13_PROFILE_PREFERENCE_PLANNING_REPORT.md`](M13_PROFILE_PREFERENCE_PLANNING_REPORT.md). Existing chart sample-size and unverified-evidence warnings remain; no scientific or formal design approval was recorded.

- Unit/integration coverage checks DOCX body/header/footer text and PNG/JPEG/SVG plus PDF inline image/XObject extraction, duplicate handling, exact hashes, manifest loading/slide association, embedded PPTX objects, and external/path-traversal rejection. PDF masks/soft masks, uncommon sample formats and DOCX comments/tracked-deletion semantics remain unimplemented.
- Detailed stage results: `docs/M9_DOCX_ASSET_EXTRACTION_REPORT.md`, `docs/M10_PDF_ASSET_EXTRACTION_REPORT.md`, `docs/M11_DOCX_HEADER_FOOTER_ASSETS_REPORT.md`, and `docs/M12_COVER_LAYOUT_CORRECTION_REPORT.md`.

## PDF inline image extraction follow-on — 2026-11-12

- `src/pdf-assets.mjs` extracts supported PDF.js inline-image and inline-image-group operators to bounded PNG assets alongside image XObjects. Group placement counts, page/operator locators, PDF SHA-256 and pending rights/verification state are retained.
- Synthetic repeated-inline-image integration verifies deterministic pixel decoding, content deduplication, CLI manifest output, and PPTX picture embedding. Masks/soft masks, uncommon sample formats, and semantic figure association remain unsupported.
- At the first M13 attempt, PowerPoint COM timed out and LibreOffice was absent. A preview rerun on the M14 descendant succeeded with PowerPoint 16.0 and Poppler; all seven pages were inspected (see the latest validation note below).
- Detailed stage results: `docs/M13_PDF_INLINE_IMAGE_EXTRACTION_REPORT.md`.

## DOCX header/footer text follow-on — 2026-11-12

- `src/document-extractors.mjs` now extracts paragraphs from headers/footers only when the main document references those parts, with stable package-part locators. The body paragraph locator sequence remains unchanged.
- Tests cover referenced header/footer extraction, relationship resolution, orphan-part exclusion, source bundle content and the unchanged native deck import path. Tables remain linearized; comments and tracked-deletion semantics are not extracted.
- Detailed stage results: `docs/M14_DOCX_HEADER_FOOTER_TEXT_REPORT.md`.

- M14 full validation: `npm test` passed 158/158; `npm run validate`, `npm run build`, `npm run preview`, and `node src/qa.mjs outputs/research-demo.pptx` all completed successfully. PowerPoint 16.0 and Poppler 26.07 rendered the 7-slide demo to PDF and seven PNGs; each page was inspected. QA reported 7 editable-text slides and one native chart. Existing evidence/sample-size warnings remain, and human approval is still pending.

## Asset usage suggestion follow-on — 2026-11-12

- Added `npm run assets:suggest` for deterministic, explainable lexical candidate ranking between slide copy and optional asset metadata. It reports matched terms, current associations, and source/license/verification review flags without changing slides or verification state.
- This is not image-semantic matching, license review, or evidence entailment. Audio/video management, semantic matching, rights validation, generic DOI full-text workflows outside Europe PMC, unbounded media acquisition, and MinerU evaluation remain incomplete.
- Detailed implementation and limitations: `docs/M15_ASSET_USAGE_SUGGESTION_REPORT.md`.

## Europe PMC DOI full-text follow-on — 2026-11-12

- Added an opt-in single-DOI import for exact Europe PMC records marked open access and carrying a PMC ID. The importer keeps JATS XML, source and metadata hashes, paragraph locators, and unverified evidence locally; rights remain pending review.
- This does not provide generic publisher DOI resolution or PDF downloads. See `docs/M16_DOI_FULLTEXT_EUROPEPMC_REPORT.md` for test and scope boundaries.

## Wikimedia Commons batch import follow-on — 2026-11-12

- Added an explicitly selected batch download of at most five Wikimedia Commons images and 50 MiB total. Provenance and rights metadata are kept per file, duplicate bytes fail the batch, and every asset remains pending human rights review.
- This is a limited batch adapter, not web crawling or unbounded media collection. See `docs/M17_COMMONS_BATCH_IMPORT_REPORT.md`.

## REST/MCP scholarly metadata search follow-on — 2026-11-12

- Added `POST /research/search` and the `aiautoslides_research_search` MCP tool over the existing OpenAlex/Crossref/arXiv metadata adapter. Both require an explicit `allow_network:true`; provider/query/result-limit validation runs at the API boundary.
- Results remain unverified metadata candidates and do not create project evidence, download full text, verify claims or call a model. Mocked integration checks cover the network gate and response state. See `docs/M18_API_RESEARCH_SEARCH_REPORT.md`.
- Generic DOI full-text retrieval outside the Europe PMC slice, web crawling, and scientific claim verification remain incomplete.

## Project research candidate registration follow-on — 2026-11-12

- Project-scoped REST/MCP search now stores bounded provider result records locally, exposes a candidate list, and allows explicit registration of one selected result as a source in Presentation IR. Search remains network opt-in; registration preserves provider/query/record hash and stays unverified.
- Source registration creates no evidence excerpt, claim, or verification state. See `docs/M19_PROJECT_RESEARCH_CANDIDATES_REPORT.md` and `docs/SCHEMA.md`.

## Pending evidence excerpt follow-on — 2026-11-12

- Project REST/MCP can list evidence records and accept a user-supplied exact excerpt tied to a known source ID and locator. New entries are always `pending`; supplied verification status is ignored, unknown source IDs and duplicate evidence IDs fail.
- The API does not inspect source bytes or verify excerpt fidelity/claim entailment. See `docs/M20_PENDING_EVIDENCE_EXCERPTS_REPORT.md`.

## Human evidence excerpt review follow-on — 2026-11-12

- Project REST/MCP now records a caller-supplied `verified` or `contradicted` excerpt review bound to the current excerpt SHA-256, with reviewer text and timestamp. Stale content and repeated final decisions are rejected.
- Reviewer identity is not authenticated; this does not verify source status or claim entailment. See `docs/M21_EVIDENCE_REVIEW_REPORT.md`.

## Stale evidence review invalidation follow-on — 2026-11-12

- General Presentation IR updates now return reviewed evidence to `pending` if its excerpt, source ID or locator changes, while retaining the previous reviewer, decision and content hash as stale audit history. Re-review clears the stale decision marker.
- See `docs/M22_STALE_EVIDENCE_REVIEW_REPORT.md`.

## Local source excerpt matching follow-on — 2026-11-12

- Evidence responses now compare excerpts verbatim against bounded, imported UTF-8 text source blobs and return a source hash, match count/offset, no-match, or a specific unavailable reason. The evidence and parent source remain pending/unverified.
- Binary sources, PDF/DOCX extraction alignment, OCR and semantic claim support remain outside this exact-text check. See `docs/M23_LOCAL_EVIDENCE_SOURCE_MATCH_REPORT.md`.

## Selectable PDF/DOCX source matching follow-on — 2026-11-12

- The project evidence API now uses the existing local PDF.js and DOCX extractors to match exact excerpts in selectable PDF page text and DOCX paragraphs, returning the extracted locator. OCR remains opt-in and is not called by this check; missing blobs and parse failures remain `unavailable` instead of inferred matches.
- See `docs/M24_PDF_DOCX_EVIDENCE_MATCH_REPORT.md` for regression and remaining limits.

## Capability status reconciliation — 2026-11-12

- Corrected current-status statements that had been superseded by later implementation: API excerpt review, local selectable PDF/DOCX matching, and native architecture rendering. Earlier milestone reports remain historical records of their original scope.
- The source-match/reviewer boundary now consistently distinguishes a verbatim provenance check from a caller-supplied human decision and from semantic scientific verification. Remaining phase-wide gaps are still listed as incomplete rather than implied complete.
- See `docs/M25_STATUS_DOC_RECONCILIATION_REPORT.md`.

## Explicit local PDF OCR in project API — 2026-11-12

- Scanned-PDF OCR can now be enabled for the local project API through an explicit CLI flag. It remains off by default, runs with local Tesseract/rasterization, and reports distinct `ocr_match` / `ocr_no_match` outcomes with confidence rather than claiming a verbatim source match.
- See `docs/M26_API_LOCAL_OCR_REPORT.md`.

## Exact repeated core explanation gate — 2026-11-13

- The formal full-deck quality audit now blocks identical substantial text repeated across core/high pages for the same declared priority (`QUALITY_PRIORITY_EXPLANATION_DUPLICATED`). Exact-match deduplication is a narrow safeguard against copied filler; semantic repetition and mislabeled priorities still require human page review.
- Adversarial evidence and verification are recorded in `docs/AI_PLANNER_VISUALS_REPORT.md`.

## Visible explanatory copy density gate (2026-11-13)

- Full-deck content pages require at least 5.5% rendered OCR body-text occupancy when a structured visual exists and 7% on text-only pages; endings require 7%. Every page needs at least two detected body-text lines. The measure excludes headlines and is derived from OCR word boxes within authored body-text geometry.
- Statement pages now render two separate explanatory paragraphs in taller boxes to reduce overflow/overlap. Adversarial density fixtures verify the strict numerical boundaries and sparse-copy failure.
- OCR density does not establish readability, visual balance, semantic sufficiency, or absence of all clipping. Human page inspection is still required. See `docs/AI_PLANNER_VISUALS_REPORT.md`.

## Rendered body-copy overflow screen (2026-11-13)

- OCR word boxes are compared with authored body-text geometry. Two or more recognizable words from authored copy outside the matching text box on any side produce `QUALITY_RENDERED_TEXT_OVERFLOW`; the finding records which edges were crossed.
- A real PowerPoint 16.0 / Poppler fixture narrows a synthetic body box and disables wrapping/autofit. The rendered S04 line visibly exits to the right; OCR reports 11 matching words outside the right edge and the normal formal gate blocks it.
- The screen allows a 1.5% page-dimension tolerance and ignores OCR words inside another text box that contains the same text token. OCR can still miss glyphs, text clipped beyond the slide canvas, or spill that cannot be linked to one authored box. Human page review remains required. See `docs/HORIZONTAL_TEXT_OVERFLOW_REPORT.md`.

## Architecture diagram logic gate (2026-11-13)

- Legacy storyboard, canonical Presentation IR, AI planner, and formal Harness validation share the same architecture graph checks: at least three named components, two or more distinct directed links, an explicit entry and output, connected topology, and every component lying on a directed entry-to-output path.
- Duplicate arrows and directionless cycles are rejected before a renderer is probed. A synthetic negative Harness test verifies the invalid graph never reaches adapter selection; a valid native architecture continues to render as editable shapes.
- These checks validate graph structure and a bounded action-word vocabulary only. They cannot tell whether a proposed architecture matches a real system or whether its causal story is meaningful to a specific audience. See `docs/ARCHITECTURE_LOGIC_GATE_REPORT.md`.

## Emitted PPTX text contrast gate (2026-11-13)

- QA now inspects actual OOXML text-run RGB colors rather than relying only on theme palette pairs. It checks each run against the slide background and known solid fills that overlap the text box, fails ratios below 4.5:1, and blocks cases where the actual background or foreground cannot be measured.
- Synthetic adversarial checks exercise low-contrast emitted text, text on known panels, and image-backed text with unknown contrast. A full-PPTX fixture proves a custom low-contrast run fails QA even while all selected theme token pairs pass.
- This is a structural color check, not a rendered-pixel or aesthetic judgment; images, gradients, inherited/scheme colors, and chart-internal labels remain outside its measurable scope and are not silently reported as passing. See `docs/PPTX_TEXT_CONTRAST_REPORT.md`.

## Native chart typography gate (2026-11-13)

- Rendered-PDF inspection exposed a chart-specific defect: academic-light's slide text used Aptos, while native chart data labels were emitted as Arial at 12 pt. Slide XML QA had not been reading the separate chart XML part, so those labels escaped the theme-font and 14 pt checks.
- Chart data labels now use the selected theme body font at 14 pt; legends use the same font and size. QA follows each slide's chart relationships and merges chart-internal font/size measurements into that slide's formal review record. Unmeasured chart text is surfaced as unmeasured and blocks formal review through the existing font/size gates.
- An adversarial PPTX fixture restores Arial/12 pt in chart XML and verifies QA reports both defects; the formal quality-audit tests verify those measurements block approval. PowerPoint 16.0 re-rendered all seven synthetic pages; page 4's PDF font table now contains Aptos/Aptos Display and no Arial. See `docs/CHART_TYPOGRAPHY_REPORT.md`.

## Fail-closed chart typography follow-on (2026-11-13)

- Review found two bypasses in the first chart gate: a chart with no `c:txPr` nodes and a broken slide-to-chart relationship were silently omitted from typography measurements. Both now surface unmeasured font and size findings, which the existing formal gate blocks.
- The real-PPTX adversarial fixture now removes every chart text style and then separately breaks the chart relationship; QA records unmeasured findings for both cases. See `docs/CHART_TYPOGRAPHY_REPORT.md`.
