# Implementation status — Phase 1 complete

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

## Remaining beyond Phase 1

- Phase 0 bakeoff is incomplete for some requested engines/task groups; blocked and unrun candidates remain identified in `docs/POC_RESULTS.md`.
- Phase 2 research integrations are implemented for opt-in OpenAlex/Crossref/arXiv metadata search, local Docling and MarkItDown extraction, single-page Crawl4AI, selected arXiv PDF download, and a one-item Wikimedia Commons asset workflow. These are CLI/local-worker routes, not API workflow actions; extracted claims and asset reuse remain pending human review.
- Phase 3 audience/narrative/media intelligence and rendered-image critic remain planned.
- Phase 4 local stdio MCP server over the loopback API is implemented; full UI, remote auth/scopes and Android remain planned.
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

## Local progress consolidation — 2026-11-12

- Added an optional Crossref DOI metadata adapter. It makes bounded GET requests, excludes abstracts, records source hashes, and leaves records unverified. The workflow recommender includes metadata lookup as a separate stage.
- Added opt-in owner-scoped API access for embedding hosts, per-user source/asset namespaces, job input snapshots and a bounded single-process scheduler. The API remains loopback-only and does not include an identity provider or OS-level tenant sandbox.
- Added strict repository and machine-local agent Git instructions, a contributor workflow/PR checklist, Windows/Linux setup scripts, and a Docker Compose CLI/rendering environment. No credentials, private source files, or generated previews are included in the commits.
- Verification on this revision: `npm ci --no-audit --no-fund`, `npm run test` (**165/165**), `npm run validate`, `npm run build`, and Docker Compose preview completed successfully. The seven-page PDF preview was visually inspected page by page. The demo continues to show its sample-size warning and unverified evidence; neither is promoted to a verified result.
- Changes are committed on `codex/local-progress-20261112` in five focused commits. This is local branch state; it has not been pushed.
