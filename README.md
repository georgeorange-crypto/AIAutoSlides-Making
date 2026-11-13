# AIAutoSlides Making

Evidence-first, offline-by-default generation of editable PowerPoint research talks. The local pipeline uses Node.js and PptxGenJS; it does not require an AI key or cloud service.

> The included KV-cache example contains user-supplied, **unverified** values. Treat its charts and claims as drafts until checked against original experiment logs. The CSV teaching workflow is explicitly **synthetic** and is not research evidence.

## Quick start — Windows PowerShell

Requirements: Node.js 20.16+, npm, and PowerPoint or LibreOffice for PDF export. Poppler (`pdftoppm`) is needed for page PNGs. Local PDF text import uses Mozilla PDF.js; Poppler `pdftotext` is optional and preferred when installed for its layout-preserving extraction.

```powershell
# Run these commands from the repository root.
npm ci
npm run check
npm run preview
```

`npm run check` runs unit/negative tests, imports the synthetic CSV, validates both storyboards, builds both PPTX files, and audits the PowerPoint XML. `npm run preview` exports the research demo to PDF and renders every PDF page to PNG. On Windows it uses locally installed PowerPoint through COM; on Linux it uses LibreOffice.

Generated artifacts are under `outputs/` (ignored by Git):

- `research-demo.pptx`, `.pdf`, `-page-1.png` … `-page-N.png`
- `research-demo.review.json` — schema/evidence warnings
- `research-demo.evidence-manifest.json` — input hashes and slide/source lineage
- `research-demo.qa.json` and `.qa.md` — editability and object audit
- Equivalent `synthetic-csv-demo.*` outputs for the synthetic example

Open **every page PNG** at presentation scale. XML QA cannot detect visual overflow, font substitution, or unintended overlap.

For the synthetic AI Systems deck, run `node scripts/build-multimodal-demo.mjs`, then use `outputs/multimodal/ai-systems-synthetic.pptx`. QA separates machine findings from subjective prompts. `node scripts/preview.mjs <deck.pptx> --renderer auto` creates hash-bound PDF/PNG output; after inspecting each page, record decisions with `node src/visual-review.mjs --pptx <deck.pptx> --reviewer "Name" --slide S01 --decision approve --note "Checked layout and evidence fit"` for every slide. See [`docs/M3A_VISUAL_REVIEW_REPORT.md`](docs/M3A_VISUAL_REVIEW_REPORT.md) for this stage's verification.

## Synthetic CSV workflow

The values in [`examples/from-csv/synthetic-latency.csv`](examples/from-csv/synthetic-latency.csv) are fictional teaching values. The importer refuses a CSV that does not identify itself as synthetic, requires consistent units and a sample count per row, and calculates a source hash.

```powershell
npm run from:csv
node src/cli.mjs validate --input outputs/synthetic-csv/storyboard.json --evidence outputs/synthetic-csv/storyboard-evidence.json
node src/cli.mjs build --input outputs/synthetic-csv/storyboard.json --evidence outputs/synthetic-csv/storyboard-evidence.json --out outputs/synthetic-csv-demo.pptx
node src/qa.mjs outputs/synthetic-csv-demo.pptx
node scripts/preview.mjs outputs/synthetic-csv-demo.pptx
```

The generated talk has eight slides with stable IDs, speaker notes, an editable native bar chart, and a slide-to-source manifest. To use actual research data, create a separate input and evidence ledger; do not mark a source verified until it has been compared with its underlying files.

CSV columns: `category,value,unit,sample_n`; values must be finite and nonnegative. Each row is one plotted category. The importer does not aggregate repetitions or infer statistical uncertainty.

### Reproducible local refresh and Talk/Reading editions (M2)

For an authorized local repeated-run CSV, refresh the deck and keep the previous refresh report as the baseline on later runs. A changed source rebuilds the deck; unchanged input skips PPTX generation while still recording the check duration. The report records exact source/run diffs, hashes, build QA, first and subsequent pipeline times. Rendering and human repair/review time are separate and are not inferred by automation.

```powershell
node src/refresh-runs.mjs D:\data\run-summary.csv outputs\my-study\runs.pptx
# later refresh: compare against the previous report
node src/refresh-runs.mjs D:\data\run-summary.csv outputs\my-study\runs.pptx outputs\my-study\runs.pptx.refresh.json 4.5
```

This workflow is local-only and writes a source-derived storyboard, evidence ledger, QA, and JSON/Markdown refresh reports beside the deck. The optional last argument records operator-measured repair minutes; it is never inferred by the software. Review reported removals and source changes. Hashes prove byte identity only; verify source provenance, units, protocol, and research assumptions yourself.

To create presentation and reading editions from one validated storyboard and evidence ledger:

```powershell
npm run build:dual -- examples/research-demo.json sources/evidence.json outputs\research-demo
```

This writes `-talk.pptx` and `-reading.pptx` plus a shared-evidence graph report. Talk preserves the authored sequence. Reading appends cited source records, chart methods, and deterministic figure-data pages. Both decks retain the same evidence IDs and source graph hash. Warnings for unverified evidence remain visible.

### Native line chart (Milestone 2 first step)

The same deterministic importer can create an editable PowerPoint line chart from a synthetic ordered series:

```powershell
npm run from:line
node src/cli.mjs validate --input outputs/synthetic-line/storyboard.json --evidence outputs/synthetic-line/storyboard-evidence.json
node src/cli.mjs build --input outputs/synthetic-line/storyboard.json --evidence outputs/synthetic-line/storyboard-evidence.json --out outputs/synthetic-line-demo.pptx
node src/qa.mjs outputs/synthetic-line-demo.pptx
node scripts/preview.mjs outputs/synthetic-line-demo.pptx
```

Line values may be signed; bar values must be nonnegative and start at zero. This step uses synthetic values. See the supported multi-series, scatter, and CDF chart workflows below. For repeated runs, see the Student-t interval workflow below.

### Local experiment run audit

For a local experiment export, use the run-audit tool to make a source-hashed manifest and compare a later export with a saved baseline. This tool does not upload data and does not create a research deck. The CSV must include `run_id`, one ISO `run_timestamp` per run, and unique `observation_id` values within each run; all other columns are preserved and included in row hashes.

```powershell
node src/run-audit.mjs D:\data\experiment.csv outputs\experiment-audit.json
# after a later export, compare it to the saved manifest
node src/run-audit.mjs D:\data\experiment.csv outputs\experiment-audit-next.json outputs\experiment-audit.json
```

Each command writes JSON and Markdown reports. The comparison is keyed by `(run_id, observation_id)` and reports added, changed, and removed rows, source SHA-256 values, and row numbers. Removed rows are reported for review, never silently discarded. Source-row numbers describe the current file layout and can change when row order changes; stable observation IDs and content hashes are the identity checks. Keep both the input CSV and baseline manifest in the same authorized local storage. The synthetic-only `from:csv` slide importer remains intentionally separate from this audit command.

## Markdown outline workflow

Use the controlled Markdown grammar in [`examples/from-markdown/research-outline.md`](examples/from-markdown/research-outline.md). It supports deck frontmatter and slide sections for cover, statement, bullets, and closing; body entries are Markdown list items, and every slide can carry evidence IDs and speaker notes.

```powershell
npm run from:markdown
node src/cli.mjs validate --input outputs/markdown/storyboard.json --evidence sources/evidence.json
node src/cli.mjs build --input outputs/markdown/storyboard.json --evidence sources/evidence.json --out outputs/markdown-demo.pptx
```

The importer is deterministic and does not invent citations or metric values. Use JSON when slides need native charts or metric cards; the Markdown importer keeps numeric/chart authoring in the explicitly structured JSON path for now.

## Build a custom storyboard

Copy `examples/research-demo.json`, update the slide text and `evidence_ids`, then add entries to `sources/evidence.json`. Chart slides require categories, finite nonnegative values, a unit, and a y-axis label. Include `sample_size` when known; otherwise the validator emits a warning. A bar chart with a nonzero minimum axis is rejected. Unknown IDs and malformed evidence entries fail validation.

```powershell
node src/cli.mjs validate --input examples/my-talk.json --evidence sources/evidence.json
node src/cli.mjs build --input examples/my-talk.json --evidence sources/evidence.json --theme academic-light --out outputs/my-talk.pptx
node src/qa.mjs outputs/my-talk.pptx
node scripts/preview.mjs outputs/my-talk.pptx
```

Supported slide types: `cover`, `statement`, `metrics`, `chart` (native bar, line, scatter or empirical CDF), `table` (native editable PowerPoint cells), `process`, `architecture` (native editable shapes and connectors), `bullets`, `closing`. Table slides accept 2–6 headers and 1–10 rows; source IDs and cell values are preserved in the evidence manifest. Deck ratio is fixed at 16:9. Bar/line CSV can use a `series` column for up to six aligned series; scatter takes numeric `x`, `x_unit`, `value`, and `unit`; CDF imports raw `value` observations and computes a right-continuous empirical staircase with grouped ties. Optional slide fields include `slide_id`, `assertion_title`, `speaker_notes`, and one of four reusable layouts: `assertion-evidence`, `two-column-contrast`, `metric-focus`, `chart-and-takeaway`.

Build the explicitly synthetic editable-table fixture with:

```powershell
node src/cli.mjs validate --input examples/table-demo/storyboard.json --evidence examples/table-demo/evidence.json
node src/cli.mjs build --input examples/table-demo/storyboard.json --evidence examples/table-demo/evidence.json --out outputs/table-demo.pptx
node src/qa.mjs outputs/table-demo.pptx
```

```powershell
npm run from:multiseries
npm run from:scatter
npm run from:cdf
```

### Repeated-run summary with Student-t intervals

The local repeated-run importer accepts a CSV with `run_id,run_timestamp,observation_id,condition,metric,value,unit`. Each row must be one pre-aggregated measurement from one independent run; the current unpaired implementation requires globally unique run and observation IDs, one metric/unit, at least 10 runs per condition, and 2–9 conditions. It calculates a two-sided 95% Student-t interval for the mean and writes asymmetric-capable native PowerPoint error bars plus source row IDs. The interval assumes independent, approximately normal run-level values. Review the run design and distribution before interpreting it; this is not a significance test and does not adjust for protocol drift, paired runs, multiple comparisons, or within-run sampling.

The committed example is synthetic and the slide warns accordingly. To use your own authorized local export, pass its path; the evidence is marked `verified:false` until you verify it against the source records. Outputs are under ignored `outputs/` and should not be pushed if they contain private research data.

```powershell
npm run from:repeated
# use a local experiment file instead:
node src/import-repeated.mjs D:\data\run-summary.csv outputs\my-runs\storyboard.json
node src/cli.mjs validate --input outputs/my-runs/storyboard.json --evidence outputs/my-runs/storyboard-evidence.json
node src/cli.mjs build --input outputs/my-runs/storyboard.json --evidence outputs/my-runs/storyboard-evidence.json --out outputs/my-runs.pptx
node src/qa.mjs outputs/my-runs.pptx
```

## Themes and local rendering

Theme tokens live in `themes/*.json`; current options are `academic-light`, `tech-dark`, and `keynote-minimal`. The project owner's current confirmed design is `keynote-minimal`; see [`docs/design.md`](docs/design.md) and [`docs/design-tokens.json`](docs/design-tokens.json). Themes use installed fonts only; check font substitution on the actual presentation machine.

### Official template source catalog

The source catalog, AI usage guide, and local-only download workflow live in [`docs/template/`](docs/template/README.md). Preview the exact direct links with `npm run templates:download -- --dry-run`; fetch catalog-listed PPTX/ZIP files into the Git-ignored local evaluation directory with `npm run templates:download -- --local-evaluation`. Downloads are not added to the repository, are not automatically extracted, and do not grant reuse or redistribution rights. See [`USER_GUIDE.md`](docs/template/USER_GUIDE.md) for the workflow and limits.

Windows rendering uses Microsoft PowerPoint if installed. If COM export is unavailable, open the PPTX in PowerPoint and use **File → Export → Create PDF/XPS**. Linux rendering requires LibreOffice Impress. Both paths require Poppler for PNG rendering. The preview command reports the number and paths of every page image; it does not claim to detect layout defects automatically.

## Optional AI storyboard

`npm run plan:ai` is opt-in and may incur API charges. It sends the local brief and evidence ledger to the configured OpenAI API. Do not use it with confidential research unless specifically authorized. Local build, validation, tests, and CSV import never call an AI service.

### Slide Critic and human review gate (M3)

Run the deterministic, offline critic on any editable storyboard. Reports list rule IDs, severity, slide IDs, element fields, specific suggestions, and the guidance source behind each rule:

```powershell
npm run critique -- --input examples/research-demo.json --evidence sources/evidence.json --out outputs/research-demo-critique
```

For factual statement, metric, and chart slides, add `claim_support` records that link each cited evidence ID to the exact claim, source excerpt, locator, and human review status. The Critic reports missing, pending, or contradicted records; it does not infer semantic entailment. Run `npm run evaluate:critic` to reproduce rule-level precision/recall on the 24-case hand-labeled synthetic fixture set. Those results check the review-state contract only, not expected accuracy on real presentations.

The optional AI planner accepts a target audience, goal and duration; its JSON output remains editable. It selects a narrative structure and proposes each slide's assertion, layout, visual needs, evidence IDs and speaker notes. It uses constrained JSON Schema, restricts citations to ledger IDs, reports numeric literals absent from the supplied brief for human checking, and writes a review checklist. Visual needs are suggestions only: the planner does not fetch assets or invent chart data. The numeric check is lexical only and cannot establish semantic support or truth. Every draft remains blocked until the existing content-hash-bound human approval step is completed.

```powershell
npm run plan:ai -- --input sources/brief.md --out outputs/research-draft.json --audience academic_conference --duration 12 --goal "Explain the result and agree on the next experiment"
npm run critique -- --input outputs/research-draft.json --evidence sources/evidence.json --out outputs/research-draft-critique
```

AI drafts marked `requires_human_review:true` cannot build until a reviewer records a decision, note, and review of all critic findings. Approval binds to a SHA-256 of the draft content; any later content change invalidates that approval. Make edits before review, then write the approved editable copy:

```powershell
npm run review:draft -- --input outputs/research-draft.json --out outputs/research-reviewed.json --decision approve --reviewer "Reviewer name" --note "Checked claims, sources, limitations and slide previews" --ack-findings all
node src/cli.mjs build --input outputs/research-reviewed.json --evidence sources/evidence.json --out outputs/research-reviewed.pptx
```

### Offline PDF/DOCX source import (M4 first tranche)

Import a local research source to quoted text with page/paragraph locators, source and extracted-text hashes, a manifest, and an evidence ledger entry. Source status stays `verified:false`; extraction never verifies scientific claims or uploads the file. DOCX uses the built-in `fflate` dependency. PDF import uses Poppler `pdftotext -layout` when installed and falls back to Mozilla PDF.js (`pdfjs-dist`) without network access; use `--pdf-engine pdfjs` to select PDF.js explicitly. For scanned PDFs, optional OCR uses bundled Tesseract.js and bundled English (`eng`) and Simplified Chinese (`chi_sim`) models. Poppler `pdftoppm` is still needed to rasterize PDF pages. OCR remains unverified and must be checked against the rendered page.

```powershell
npm run import:document -- --input "D:\research\paper.docx" --id E_LOCAL_PAPER --label "Paper methods section" --evidence sources/evidence.json --out-prefix outputs/imports/paper
Get-Content outputs/imports/paper.md
```

The command writes `.md`, `.manifest.json`, and `.evidence.json` files under the selected output prefix. When an existing ledger is supplied, its entries are copied and the new unverified entry is appended to the generated ledger; the original ledger is not modified. DOCX body paragraphs and referenced header/footer paragraphs are extracted with distinct locators; tables are linearized, while comments and tracked-deletion semantics are not extracted. Use the generated evidence ID in a storyboard and cite the exact excerpt/locator in `claim_support`.

For PDF or DOCX files, add `--extract-images` to create `<out-prefix>.assets/` and `<out-prefix>.assets.json`. DOCX imports copy referenced body, header, and footer PNG/JPEG/SVG parts with package-part and relationship locators. PDF imports decode supported inline images and image XObjects to PNG with page and operator locators; inline image groups retain their placement count. These are decoded images, not page screenshots or original compressed PDF streams. Both manifest types retain the source-document SHA-256, image SHA-256, and `verified:false`; duplicate bytes are deduplicated. Rights inherit from the source document and remain unreviewed. Pass the generated JSON to `--assets` after adding its asset IDs to the storyboard. PDF image masks/soft masks, uncommon sample formats, vector drawing extraction, OCR-driven figure association, and semantic placement are not supported.

See [`docs/M9_DOCX_ASSET_EXTRACTION_REPORT.md`](docs/M9_DOCX_ASSET_EXTRACTION_REPORT.md), [`docs/M10_PDF_ASSET_EXTRACTION_REPORT.md`](docs/M10_PDF_ASSET_EXTRACTION_REPORT.md), [`docs/M11_DOCX_HEADER_FOOTER_ASSETS_REPORT.md`](docs/M11_DOCX_HEADER_FOOTER_ASSETS_REPORT.md), [`docs/M12_COVER_LAYOUT_CORRECTION_REPORT.md`](docs/M12_COVER_LAYOUT_CORRECTION_REPORT.md), [`docs/M13_PDF_INLINE_IMAGE_EXTRACTION_REPORT.md`](docs/M13_PDF_INLINE_IMAGE_EXTRACTION_REPORT.md), and [`docs/M14_DOCX_HEADER_FOOTER_TEXT_REPORT.md`](docs/M14_DOCX_HEADER_FOOTER_TEXT_REPORT.md) for test results and current limits.

For a scanned PDF, install Poppler locally and explicitly opt into OCR. Tesseract.js and its `eng`/`chi_sim` models are installed with the project dependencies; a separate Tesseract binary or language-pack installation is not needed:

```powershell
npm run import:document -- --input "D:\research\scanned-paper.pdf" --id E_LOCAL_SCAN --ocr tesseract --ocr-lang eng --out-prefix outputs/imports/scanned-paper
```

The run stays offline: the OCR engine and language models are read from local npm packages, while Poppler's `pdftoppm` performs local page rasterization. Select `--ocr-lang eng`, `chi_sim`, or `eng+chi_sim`. It fails with an actionable dependency error if `pdftoppm` is unavailable. The manifest records page-level confidence, method and language, but confidence is not scientific verification and the evidence ledger remains `verified:false`.

### Local update benchmark (synthetic)

Run a reproducible first-generation / one-row-update timing and structural fidelity check on the bundled synthetic repeated-run fixture:

```powershell
npm run benchmark:update
Get-Content outputs/m4/update-benchmark.benchmark.md
```

This measures the local CSV import, validation, PPTX build, and structural QA pipeline. It reports source diffs, evidence-ID coverage, native chart/workbook values, and editability; it does not measure human repair time or prove cross-platform office rendering quality. The recorded workstation run is in [`docs/M4_UPDATE_BENCHMARK.md`](docs/M4_UPDATE_BENCHMARK.md).

For repeated local samples, pass `--samples` (1–20); the report then includes every sample and median/range/p90 summaries. These timings remain synthetic and machine-load dependent. To record an actual manual PPTX repair session without storing slide content, start a timer before editing and stop it afterward:

```powershell
npm run benchmark:repair -- start --session outputs/m4/repair-session.json --deck outputs/research-demo.pptx --label "research-demo-review"
# Edit and save the deck in PowerPoint.
npm run benchmark:repair -- stop --session outputs/m4/repair-session.json --deck outputs/research-demo.pptx --edits 2
Get-Content outputs/m4/repair-session.json
```

The timer records elapsed time, edit count, deck filename and before/after SHA-256 only. It does not capture or upload deck text. Do not use placeholder or synthetic manual-repair durations in product comparisons.

To collect blinded design ratings, prepare A/B copies, record each rater's scores (1–5) against the six weighted rubric dimensions, and summarize before explicitly opening the condition key:

```powershell
npm run benchmark:blind-review -- prepare --a outputs/native.pptx --b outputs/alternative.pptx --out outputs/m4/blind
npm run benchmark:blind-review -- score --manifest outputs/m4/blind/blind-manifest.json --deck A --reviewer R01 --scores docs/M4_BLIND_REVIEW_SCORE_TEMPLATE.json --out outputs/m4/blind/rating-a.json
npm run benchmark:blind-review -- score --manifest outputs/m4/blind/blind-manifest.json --deck B --reviewer R01 --scores docs/M4_BLIND_REVIEW_SCORE_TEMPLATE.json --out outputs/m4/blind/rating-b.json
npm run benchmark:blind-review -- summarize --rating=outputs/m4/blind/rating-a.json --rating=outputs/m4/blind/rating-b.json --out outputs/m4/blind/summary.json
```

No ratings are prefilled. `blind-key.json` maps randomized labels to input conditions for a later explicit `unblind` command. Deck metadata or visual identity may still reveal the source, so this is label blinding rather than guaranteed perceptual blinding.

To compare the built-in themes, generate a 2-slide cover/chart preview in each theme, inspect the six PNGs, and confirm a selection explicitly. No proprietary template or asset is copied.

```powershell
npm run theme-gallery -- --input examples/research-demo.json --evidence sources/evidence.json --out outputs/theme-gallery
npm run select:design -- --gallery outputs/theme-gallery/gallery.json --theme academic-light --reviewer "Reviewer name" --confirm yes --out docs/design.md
```

The selection command writes the confirmed theme profile to `docs/design.md` and `docs/design-tokens.json`; change the theme argument to the option you actually select. A gallery alone does not mark any option as confirmed.

### Local image assets (Milestone 3A first vertical slice)

Reference local PNG, JPEG, or SVG images in an asset manifest. Paths are relative to the manifest. Every asset records its MIME/type, SHA-256, source, license, and human verification state; duplicate bytes, missing files, mismatched hashes, missing provenance, and unknown slide references fail the build. Slides use `visuals` placements with slide-relative inch coordinates. Embedded SVGs are PowerPoint image objects; their internal paths are not individually editable shapes. `assets:suggest` ranks candidate assets with deterministic lexical overlap against slide assertions and optional asset description, alt text, and keywords; it reports matched terms and rights/provenance review flags without editing the storyboard. This is a review aid, not semantic image recognition, legal review, or claim verification. No asset is uploaded.

```powershell
node scripts/build-multimodal-demo.mjs
node src/assets-cli.mjs examples/multimodal/assets.json
npm run assets:suggest -- --storyboard examples/multimodal/storyboard.json --assets examples/multimodal/assets.json --out outputs/multimodal/asset-suggestions.json
node src/cli.mjs validate --input examples/multimodal/storyboard.json --evidence examples/multimodal/evidence.json --assets examples/multimodal/assets.json
node src/cli.mjs build --input examples/multimodal/storyboard.json --evidence examples/multimodal/evidence.json --assets examples/multimodal/assets.json --out outputs/multimodal/ai-systems-synthetic.pptx
node src/qa.mjs outputs/multimodal/ai-systems-synthetic.pptx
```

`node scripts/build-multimodal-demo.mjs` deterministically rebuilds the explicitly synthetic/hypothetical 10-slide AI Systems storyboard and evidence ledger from the technical Markdown, architecture JSON, and synthetic CSV. It includes two original local SVG illustrations, a native editable architecture diagram, a native CSV-derived chart, notes, and evidence IDs. SVGs are image objects; architecture nodes and connectors are native PowerPoint objects. All source records remain `verified:false`. Build to `outputs/multimodal/ai-systems-synthetic.pptx`; use `node scripts/preview.mjs outputs/multimodal/ai-systems-synthetic.pptx` for local PDF/PNG rendering. PowerPoint 16.0 and Poppler rendered all 10 pages in the current environment; the assistant inspected each PNG, and human slide sign-off remains pending.

## Research and design rules

- Titles state the slide's point; evidence stays attached to each factual slide.
- Use editable text, shapes, and chart objects. Images are not a substitute for editable slide content.
- Keep source verification state visible. `verified:false` produces a warning and is not scientific validation.
- Preserve units, baselines, sample counts, and aggregation method. Do not infer confidence intervals or significance.
- Audience and context matter: investment-pitch guidance is not a rulebook for systems research talks.
- Third-party guidance is translated into independent checks; no copyrighted templates, fonts, or artwork are bundled.

See [`docs/PROJECT_CAPABILITIES_QA.md`](docs/PROJECT_CAPABILITIES_QA.md) for the capability Q&A, [`docs/PRODUCTIZATION_AND_DESIGN_QA.md`](docs/PRODUCTIZATION_AND_DESIGN_QA.md) for App, AI integration, content design, personalization and research workflow Q&A, and [`docs/LOCAL_SLIDE_GUIDANCE.md`](docs/LOCAL_SLIDE_GUIDANCE.md) for an offline summary of presentation guidance by institution and use case; [`docs/REFERENCES.md`](docs/REFERENCES.md) for source links; [`docs/RESEARCH_APPLICATION_MATRIX.md`](docs/RESEARCH_APPLICATION_MATRIX.md) for source-to-code traceability; [`docs/PRODUCT_BENCHMARK.md`](docs/PRODUCT_BENCHMARK.md) for a measurement protocol; and [`docs/SCHEMA.md`](docs/SCHEMA.md) and [`docs/CODEX_MASTER_PROMPT.md`](docs/CODEX_MASTER_PROMPT.md) for data contracts and roadmap.

M4's local-source import, synthetic update-cost benchmark, open-source editable-PPTX comparison and official ecosystem capability review are documented in [`docs/M4_IMPLEMENTATION_REPORT.md`](docs/M4_IMPLEMENTATION_REPORT.md), [`docs/M4_UPDATE_BENCHMARK.md`](docs/M4_UPDATE_BENCHMARK.md), [`docs/M4_BACKEND_COMPARISON.md`](docs/M4_BACKEND_COMPARISON.md), and [`docs/M4_ECOSYSTEM_REVIEW.md`](docs/M4_ECOSYSTEM_REVIEW.md). The Slidev comparison is an optional, locally reproduced prototype and is not part of default dependencies or CI. No cloud account or provider API was connected.

## CI and repository state

GitHub Actions runs `npm ci` and `npm run check`, then uploads both PPTX outputs and QA reports. It does not use paid APIs. Local preview rendering uses installed desktop software and is not part of CI.

## Tool Matrix and Workflow V2 (P0 registry tranche)

The V2 architecture and original task briefs are preserved in `docs/ARCHITECTURE_V2.md` and `docs/AI4Slides_*.md`. The current local registry contains 55 candidate/integrated manifests, a versioned adapter contract and versioned Source/Evidence IR, Presentation IR and Run Manifest schemas. Cataloguing does not mean a tool is integrated or tested; see `docs/INTEGRATION_STATUS.md` for the audited boundary and next phase.

```powershell
npm exec ai4slides -- tools list
npm exec ai4slides -- tools doctor
npm exec ai4slides -- tools test pptxgenjs
npm exec ai4slides -- tools test docling
```

The last command reports `blocked` until an executable adapter exists. Discovery and doctor do not contact external services. Existing `npm run build`, `npm run validate`, `npm run test`, and `npm run check` remain the legacy pipeline.

### Local Google Slides authorization test

The repository now includes a loopback-only Google OAuth test page. It uses PKCE and requests OpenID identity or Google Slides read-only access. It can read the title and slide count of a presentation ID you enter. It does not create or edit a deck, upload local files, persist tokens, or send source materials. Google login is **not** end-to-end verified until you configure your own OAuth Desktop client and complete consent.

1. In Google Cloud Console, configure OAuth consent and create an OAuth client with application type **Desktop app**; enable Google Slides API for that project.
2. Save its downloaded client JSON locally. Do not commit or send it.
3. Run:

```powershell
$env:GOOGLE_OAUTH_CLIENT_FILE = "D:\path\to\client_secret.json"
npm run connect:google
```

Open the printed `http://127.0.0.1:<port>` address. Click a consent button when ready; the Slides button asks for `presentations.readonly`. Enter an existing presentation ID only if you want to verify metadata access. Stop with Ctrl+C, then clear the environment variable with `Remove-Item Env:GOOGLE_OAUTH_CLIENT_FILE`.

### Local Canva login test

Canva login is also available as a local loopback-only test. It uses PKCE and requests only `profile:read`, then reads the current user's display name. It does not access designs, create or export a deck, upload files, persist tokens, or send project materials. A real login still requires your own Canva Developer app and consent.

1. Create a **public or private** user-facing app in the Canva Developer Portal. Enable the `profile:read` scope and register this exact redirect URL: `http://127.0.0.1:53682/callback`.
2. Set the app's client ID and secret in your local shell (do not commit them):

   ```powershell
   $env:CANVA_CLIENT_ID = "your-client-id"
   $env:CANVA_CLIENT_SECRET = "your-client-secret"
   npm run connect:canva
   ```

3. Open the printed local URL and choose **Connect Canva account**. Stop with Ctrl+C, then clear both environment variables.

Canva's OAuth consent and token exchange have not been exercised against a real account in this repository; automated tests use a mocked token/profile service. See [Canva OAuth documentation](https://www.canva.dev/docs/apps/rest-apis/authentication/) and [current-user profile endpoint](https://www.canva.dev/docs/apps/rest-apis/reference/users/users-profile/).

Compare open-source and hosted options by workflow stage:

```powershell
npm run tools -- tools recommend research
npm run tools -- tools recommend pitch
npm run tools -- tools recommend modify
npm run tools -- tools recommend update
npm run tools -- tools recommend web
npm run tools -- tools recommend multiengine
```

Recommendations include a primary and alternatives per stage plus implementation, network, auth, cost, editability, and trade-off fields. They are advisory: the command does not install, authenticate, or run candidates. Check `npm run tools -- tools doctor <id>` before relying on a local executable; catalog membership and upstream licenses are not integration evidence.

### Presentation IR → native PptxGenJS (Phase 1 slice)

The versioned Presentation IR is semantically validated before rendering. The local PptxGenJS adapter maps supported text, bullets, tables, cards, process, positioned local images and chart elements into the evidence-first renderer. It writes a PPTX, mapped inputs, per-element lineage, structural QA and a run manifest. Local images require source/hash/license/rights metadata; restricted rights and external URLs are rejected. Source verification is never upgraded.

```powershell
npm run render:ir -- --input examples/phase1/pptxgenjs-ir.json --out outputs/phase1/my-deck
node src/qa.mjs outputs/phase1/my-deck/presentation.pptx
npm run tools -- tools doctor pptxgenjs-ir
npm run tools -- tools test pptxgenjs-ir
```

The checked-in input is synthetic QA data. The PptxGenJS adapter emits native PowerPoint charts; source verification warnings remain in the report. The mapping covers a documented element subset. Mermaid source is preserved as text, not converted to editable diagram geometry.

Slidev is an optional local PDF/PNG backend and editable-PPTX comparison. It compiles Presentation IR, stages hash-checked local assets and preserves lineage:

```powershell
npm run render:slidev-ir -- --input examples/phase1/pptxgenjs-ir.json --out outputs/phase1/slidev-preview --formats pdf,png
```

Set `SLIDEV_CLI` and `SLIDEV_CHROME_PATH` after installing Slidev and Chrome in an isolated local environment. PDF/PNG are the default. PPTX export is rejected when Slidev rasterizes content and fails editable-text/source-lineage QA; Slidev does not produce native chart objects. Use PptxGenJS for the primary editable research deck.

### Local projects API (Phase 1)

Start the loopback-only REST service with a durable workspace:

```powershell
npm run api -- --workspace D:\AIAutoSlidesData --port 8787
```

The service stores projects, slide IR revisions, source metadata, job transitions, artifacts and hashes in SQLite. Place input files in `<workspace>\incoming`; `POST /projects/{id}/sources` imports only from that directory and copies raw bytes to immutable `source-blobs/<sha256>`. Create a project with `POST /projects` and a JSON body containing `title` and `presentation_ir`; start a generation job with `POST /projects/{id}/jobs`. The local workflow inventories evidence without searching the web, plans slide takeaways and adapter capabilities, generates PPTX, renders PDF/PNG previews, runs structural QA, and records artifacts and stage logs. Set `{"preview":false}` on job creation to skip PowerPoint/Poppler previews.

Available routes are documented in [`docs/API_WORKFLOW.md`](docs/API_WORKFLOW.md). The API binds only to loopback and is intended for one local user; it has no remote authentication or OS-level sandbox. Node 22.5 or newer is required for the API's built-in SQLite runtime. The legacy slide CLI remains available on the package's existing minimum Node version. A slide PATCH updates the validated IR revision; a later job rebuilds the whole deck, so unchanged-slide hash preservation is not promised.

## Verified in this checkout

On 2026-11-12, `npm ci`, `npm run check`, and PowerPoint-to-PDF-to-PNG preview completed on this Windows checkout (Node.js 24.14.0, PptxGenJS 4.0.1, fflate 0.8.3). Manual page review covers the 7-slide research deck, the 8-slide Markdown deck, and five 8-slide CSV chart decks: bar, line, multi-series line, scatter, and ECDF. The repeated-run Student-t deck has structural QA coverage (native error-bar values equal source intervals), but its fresh pixel preview has not been manually reviewed because the PowerPoint COM renderer hung on that attempt. Other visual and QA limitations remain; the research-demo report warns because E1/E2 are unverified and its chart lacks a sample count. Synthetic fixture reports warn by design and are not empirical evidence.

## License

Project code is MIT licensed; see [`LICENSE`](LICENSE). External links are references, not permission to redistribute their copyrighted material.

## Editable code snippet slides

Use `type: "code"` with a supported language, filename, source lines, and evidence IDs. The renderer creates native editable PowerPoint text objects and wraps long lines at whitespace or punctuation while retaining their exact text in the evidence manifest. The layout is limited to 20 displayed lines; the snippet is not parsed or executed.

```powershell
node src/cli.mjs validate --input examples/code-demo/storyboard.json --evidence examples/code-demo/evidence.json
node src/cli.mjs build --input examples/code-demo/storyboard.json --evidence examples/code-demo/evidence.json --out outputs/code-demo.pptx
node src/qa.mjs outputs/code-demo.pptx
node scripts/preview.mjs outputs/code-demo.pptx
```

The example is synthetic. QA compares each displayed segment with the source lines, but does not validate code behavior or font availability. See [`docs/M3A_CODE_SLIDE_REPORT.md`](docs/M3A_CODE_SLIDE_REPORT.md).

## Editable timeline slides

Use `type: "timeline"` for 3–6 ordered events with `when`, `label`, optional `detail`, and evidence IDs. The renderer uses editable PowerPoint lines, markers, and text. Time labels are display text; the tool does not parse dates or confirm that a plan is approved or completed.

```powershell
node src/cli.mjs validate --input examples/timeline-demo/storyboard.json --evidence examples/timeline-demo/evidence.json
node src/cli.mjs build --input examples/timeline-demo/storyboard.json --evidence examples/timeline-demo/evidence.json --out outputs/timeline-demo.pptx
node src/qa.mjs outputs/timeline-demo.pptx
node scripts/preview.mjs outputs/timeline-demo.pptx
```

The included timeline is synthetic and hypothetical. See [`docs/M3A_TIMELINE_REPORT.md`](docs/M3A_TIMELINE_REPORT.md).

## Ten-slide synthetic AI Systems acceptance deck

The complete synthetic/hypothetical example combines local Markdown, CSV, architecture JSON, two locally sourced SVG demonstrations, a 10-slide storyboard, source notes and the evidence ledger. Rebuild all artifacts from the repository root:

```powershell
node src/cli.mjs validate --input examples/multimodal/storyboard.json --evidence examples/multimodal/evidence.json --assets examples/multimodal/assets.json
node src/cli.mjs build --input examples/multimodal/storyboard.json --evidence examples/multimodal/evidence.json --assets examples/multimodal/assets.json --out outputs/multimodal/ai-systems-synthetic.pptx
node scripts/preview.mjs outputs/multimodal/ai-systems-synthetic.pptx --renderer auto
node src/qa.mjs outputs/multimodal/ai-systems-synthetic.pptx
```

PPTX, PDF, ten page PNGs, preview, evidence manifest and QA reports are written under `outputs/multimodal/`. Synthetic values remain unverified; the two SVGs are embedded picture objects and their `verified:false` state requires human provenance review. See [`docs/M3A_SYNTHETIC_DECK_REPORT.md`](docs/M3A_SYNTHETIC_DECK_REPORT.md).

## Local MCP server

The stdio MCP server exposes the local project API to MCP clients. Start the API in one terminal, then configure the MCP client to run `node src/mcp.mjs`; see [`docs/MCP_SERVER.md`](docs/MCP_SERVER.md) for Codex and Claude Code examples. The server accepts only a loopback API URL, performs no web research or model calls, and expects the MCP host to request user approval for project edits, source import and render jobs.

## Codex and Claude Code Skills

This repository includes the same AIAutoSlides presentation workflow Skill in `.agents/skills/aiautoslides/` for Codex and `.claude/skills/aiautoslides/` for Claude Code. Start a new session in the repository to discover it; the canonical copy is `skills/aiautoslides/SKILL.md`. The Skill guides the local evidence-first validate → build → QA → render → inspect workflow. It does not grant API access or call a model; AI planning remains explicitly opt-in. `npm test` checks that the host-specific copies stay synchronized. Details and verification are in [`docs/M8_AGENT_SKILLS_REPORT.md`](docs/M8_AGENT_SKILLS_REPORT.md).
