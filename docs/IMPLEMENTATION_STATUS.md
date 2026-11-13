# Implementation status — current roadmap snapshot (2026-11-12)

This top-level section supersedes older phase summaries below where they describe current work as planned or absent. Historical dated sections are retained as records of earlier verification snapshots.

## Current phase status

| Phase / item | Status | Evidence and remaining gate |
|---|---|---|
| Phase 0 — baseline and candidate bakeoff | **partial / incomplete** | PptxGenJS, Slidev and deterministic PPTAgent HTML conversion produced reviewed decks. Presenton local service/API smoke passed but generation failed because its configured Ollama model is absent. slide-maker and SlidePoise remain unrun. None of the three required matched task groups has been evaluated across candidates. See `docs/POC_RESULTS.md`. |
| Phase 1 — IR, adapters, workflow and local API | **implemented / tested** | Versioned IR, PptxGenJS and Slidev paths, SQLite-backed loopback API, durable jobs, edits, artifacts and review state are present. Single-user, single-process limitations remain. |
| Phase 2 — research/document/media | **bounded slice implemented / tested** | Opt-in metadata search can now attach unverified candidates to a local project through REST/MCP; local extraction, one-page crawl, selected arXiv PDF and selected Commons image are implemented. No automatic scientific verification, bulk acquisition, or durable full research DAG. |
| Phase 3 — Presentation Intelligence + Critic | **bounded deterministic slice implemented in this revision** | Audience-aware narrative roles, per-slide evidence/media candidates/time allocation are produced from IR. The workflow Critic combines OOXML layout/editability/chart QA with local OCR coverage when preview pages exist. Semantic support, aesthetic judgment, verified facts and human approval remain outside automation. |
| Phase 4 — App + MCP + QA | **local API/MCP slice implemented; desktop UI blocked behind Phase 0 decision** | Loopback REST + stdio MCP expose project, source, profile, slide, plan, critique, render, job, artifact listing/export, and scholarly metadata search with a required explicit outbound opt-in. Local-only preference profiles can seed new projects. No Windows GUI/installer, authenticated remote API or Android client. UI choice remains gated on Phase 0 evidence. |
| Cross-cutting IR/editability | **partial** | Supported element subset fails closed; Mermaid is preserved as source text or backend-specific rendering, not native PowerPoint shapes. Re-render still rebuilds the full deck; unchanged-slide output hash preservation is not guaranteed. |
| Cross-cutting license audit | **partial / release gate** | Direct licenses and integration postures are recorded. The transitive npm inventory and local artifact/model/font/template notices still require coverage and legal review before redistribution. |

## This revision's evidence

- Added deterministic audience-specific narrative roles and per-slide takeaway, evidence references, media candidates/selection reason, and duration allocation to the Presentation IR workflow and local API.
- Added local rendered-page OCR coverage screening for Critic output, together with OOXML per-slide bounds, overlap, text-size, editability, table/chart and chart-value results. Preview-disabled jobs explicitly report `not_rendered`; OCR initialization/page failures degrade to `unavailable`/`partial` without discarding a successful deck; image checks do not imply visual approval or scientific verification.
- Added read-only REST/MCP `plan_deck` and `critique_deck` operations. MCP remains stdio and requires the local API to be started separately.
- Added read-only MCP `aiautoslides_export_deck`, which locates the newest PPTX artifact and returns its SHA-256 plus the existing loopback download route; it does not start a render or embed deck bytes.
- Added project-scoped REST/MCP scholarly metadata `research_topic`; outbound calls require `allow_network: true`, persist provider records as unverified source candidates with record hashes and locators, and do not download full text or create evidence excerpts. Repeat imports are idempotent for matching record hashes. API/MCP regression coverage injects a local fake searcher; no public provider was contacted during verification.
- Added SQLite-backed local preference profiles through REST and MCP (`GET/POST /profiles`, `GET/PATCH /profiles/{id}`). New projects can select a profile; audience, duration and theme are defaults only, preserving explicit IR values. Profiles cannot enable network or paid API use.
- Fixed the optional AI planner's review sidecar to serialize the computed Critic report, and extracted record construction into a unit-testable helper. The network-backed AI planner was not invoked.
- Added regression coverage for same-IR audience differentiation, evidence/media/time planning, rendered-image OCR screen behavior, API/MCP planning and critique, and AI review record serialization.
- Latest verification after local-profile REST/MCP changes: `node --test tests/api.test.mjs tests/mcp.test.mjs` **7/7 passed**; `npm run test` **168/168 passed**; `npm run validate` exit 0 with three disclosed warnings (missing sample size, E1/E2 unverified); `npm run build` exit 0; `node src/qa.mjs outputs/research-demo.pptx` exit 0 with 7/7 text-editable slides and one native chart; `npm run preview` exit 0 using PowerPoint 16.0 and Poppler 26.07.0, producing seven PNG pages. All seven current pages were directly inspected; no obvious clipping or overlap was found. Visual review remains an engineering inspection, not scientific verification or formal approval.
- Workflow integration smoke: Presentation IR fixture completed all workflow stages with preview enabled, produced 3 PNGs, and wrote `workflow.critique.json`. OCR screen status was `review` (one page low text coverage); `scientific_accuracy=not_assessed` and `visual_review=pending_human` remained intact. The temporary smoke artifacts were removed after inspecting the report.
- See the final verification record below for commands actually run on this revision. No external candidate installation, paid call, user-source upload, remote authentication, legal approval, or human visual sign-off is claimed.

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
- Phase 2 research integrations are implemented for opt-in OpenAlex/Crossref/arXiv metadata search (CLI and project-scoped API/MCP candidate import), local Docling and MarkItDown extraction, single-page Crawl4AI, selected arXiv PDF download, and a one-item Wikimedia Commons asset workflow. Document/crawl/download chains are not yet durable API jobs; extracted claims and asset reuse remain pending human review.
- Phase 3 deterministic planning and OCR/OOXML screening are implemented; content value selection, argument entailment, aesthetic review, media search and real-time presentation timing remain unimplemented.
- Phase 4 local stdio MCP server over the loopback API now includes `research_topic` (required outbound opt-in) and `export_deck` (PPTX route + hash); Windows UI/installer, remote auth/scopes and Android remain planned and are gated on the Phase 0 product decision.
- Preference profiles are exposed via REST/MCP but do not synchronize across machines; language, tone and slide density are stored but not yet wired into generation.
- Full Presentation IR element coverage, native Mermaid shape rendering and unchanged-slide hash preservation remain incomplete.
- Transitive dependency, model and media-license audit remains incomplete.

## Phase 2 research, document and asset workflows — 2026-11-12

- Implemented: opt-in OpenAlex/Crossref/arXiv metadata search; local Docling and MarkItDown extraction; single-page Crawl4AI with robots check, same-host requests and URL/IP safeguards; selected single-paper arXiv PDF download; and separately selected one-item Wikimedia Commons media retrieval. Commands and safety boundaries are documented in `docs/PHASE2_RESEARCH_SEARCH.md`.
- Retrieval and extraction artifacts include source identifiers, URLs or local locators, retrieval time, source/response/content hashes where applicable, and short excerpt candidates. Candidates remain unverified and asset rights remain pending human review.
- The existing local document importer also provides offline PDF OCR, DOCX body/header/footer image extraction, and PDF image-XObject extraction with hashes and source locators. PDF inline-image extraction and DOCX header/footer text extraction remain unsupported.
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
- Unit/integration coverage checks DOCX body/header/footer PNG/JPEG/SVG and PDF XObject extraction, duplicate handling, exact hashes, manifest loading/slide association, embedded PPTX objects, and external/path-traversal rejection. PDF inline-image extraction and DOCX header/footer text extraction remain unimplemented.
- Detailed stage results: `docs/M9_DOCX_ASSET_EXTRACTION_REPORT.md`, `docs/M10_PDF_ASSET_EXTRACTION_REPORT.md`, `docs/M11_DOCX_HEADER_FOOTER_ASSETS_REPORT.md`, and `docs/M12_COVER_LAYOUT_CORRECTION_REPORT.md`.
