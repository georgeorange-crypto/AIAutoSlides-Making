# Implementation status — current roadmap snapshot (2026-11-12)

This top-level section supersedes older phase summaries below where they describe current work as planned or absent. Historical dated sections are retained as records of earlier verification snapshots.

## Current phase status

| Phase / item | Status | Evidence and remaining gate |
|---|---|---|
| Phase 0 — baseline and candidate bakeoff | **partial / incomplete** | PptxGenJS, Slidev and deterministic PPTAgent HTML conversion produced reviewed decks. Presenton local service/API smoke passed but generation failed because its configured Ollama model is absent. slide-maker and SlidePoise remain unrun. None of the three required matched task groups has been evaluated across candidates. See `docs/POC_RESULTS.md`. |
| Phase 1 — IR, adapters, workflow and local API | **implemented / tested** | Versioned IR, PptxGenJS and Slidev paths, SQLite-backed loopback API, durable jobs, edits, artifacts and review state are present. Single-user, single-process limitations remain. |
| Phase 2 — research/document/media | **bounded slice implemented / tested** | Opt-in metadata search, selected arXiv PDF download/local extraction, imported local PDF/DOCX extraction with optional durable Docling or MarkItDown, operator-authorized single-page Crawl4AI, and selected Commons image download are durable REST/MCP jobs. No automatic scientific verification, bulk acquisition, or multi-stage durable research DAG. |
| Phase 3 — Presentation Intelligence + Critic | **bounded deterministic slice implemented in this revision** | Audience-aware narrative roles, per-slide evidence/media candidates/time allocation are produced from IR. The workflow Critic combines OOXML layout/editability/chart QA with local OCR coverage when preview pages exist. Semantic support, aesthetic judgment, verified facts and human approval remain outside automation. |
| Phase 4 — App + MCP + QA | **local API/MCP slice implemented; desktop UI blocked behind Phase 0 decision** | Loopback REST + stdio MCP expose project, source, profile, slide, plan, critique, render, job, artifact listing/export, scholarly metadata search, selected arXiv/document ingestion, explicitly authorized one-page crawl, and one selected Commons image download. Local-only preference profiles can seed new projects. No Windows GUI/installer, authenticated remote API or Android client. UI choice remains gated on Phase 0 evidence. |
| Cross-cutting IR/editability | **partial** | Supported element subset fails closed; Mermaid is preserved as source text or backend-specific rendering, not native PowerPoint shapes. Re-render still rebuilds the full deck; unchanged-slide output hash preservation is not guaranteed. |
| Cross-cutting license audit | **partial / release gate** | Direct licenses and integration postures are recorded. The transitive npm inventory and local artifact/model/font/template notices still require coverage and legal review before redistribution. |

## This revision's evidence

- Added deterministic audience-specific narrative roles and per-slide takeaway, evidence references, media candidates/selection reason, and duration allocation to the Presentation IR workflow and local API.
- Local profile language, tone and slide-density preferences now flow into the deterministic content-plan report. Explicit Presentation IR metadata overrides profile defaults; these values remain authoring guidance and do not cause deterministic translation or text rewriting.
- Added local rendered-page OCR coverage screening for Critic output, together with OOXML per-slide bounds, overlap, text-size, editability, table/chart and chart-value results. Preview-disabled jobs explicitly report `not_rendered`; OCR initialization/page failures degrade to `unavailable`/`partial` without discarding a successful deck; image checks do not imply visual approval or scientific verification.
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
- Full Presentation IR element coverage, native Mermaid shape rendering and unchanged-slide hash preservation remain incomplete.
- Transitive dependency, model and media-license audit remains incomplete.

## Phase 2 research, document and asset workflows — 2026-11-12

- Implemented: opt-in OpenAlex/Crossref/arXiv metadata search; local Docling and MarkItDown extraction; single-page Crawl4AI with robots check, same-host requests and URL/IP safeguards; selected single-paper arXiv PDF download; and separately selected one-item Wikimedia Commons media retrieval. Commands and safety boundaries are documented in `docs/PHASE2_RESEARCH_SEARCH.md`.
- Retrieval and extraction artifacts include source identifiers, URLs or local locators, retrieval time, source/response/content hashes where applicable, and short excerpt candidates. Candidates remain unverified and asset rights remain pending human review.
- The existing local document importer also provides offline PDF OCR, DOCX body/header/footer image extraction and text extraction for section-referenced headers/footers, plus bounded PDF image-XObject and inline-image extraction with hashes and source locators. PDF masks/soft masks and uncommon sample formats remain unsupported.
- Search/download boundaries are explicit: network calls require opt-in; image search does not download files; only one selected arXiv paper or Commons image can be downloaded per command; web crawl does not traverse links or fetch media.
- Docling 2.150.0 and Crawl4AI 0.9.5 are pinned in the isolated Python runtime. Docling model downloads are opt-in. Crawl4AI requires its locally installed Playwright Chromium. MarkItDown 0.1.9 uses its separate isolated worker.
- Phase 2 is complete for this bounded integration slice. API workflow research actions, DOI full-text resolution beyond arXiv, bulk media acquisition, MinerU integration/licensing, automated scientific verification and parser-accuracy evaluation remain planned or out of scope.
- The prior combined `npm run check` record on the PDF/DOCX asset and cover-layout update is exit 0 with 153/153 tests and the synthetic import/build/QA sequence. On the current latest revision, I separately reran the full suite: `npm run test` passed **157/157**; `npm run validate` and `npm run build` exited 0; `node src/qa.mjs outputs/research-demo.pptx` confirmed 7 editable slides and 1 native chart; `npm run preview` rendered seven pages using PowerPoint 16.0 and Poppler 26.07.0, and each page was visually inspected. One chart sample-size warning and two unverified evidence entries remain. The cover title wraps within the content column without intruding into the decorative panel; human design approval remains pending.

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
