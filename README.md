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

Supported slide types: `cover`, `statement`, `metrics`, `chart` (native bar, line, scatter or empirical CDF), `process`, `bullets`, `closing`. Deck ratio is fixed at 16:9. Bar/line CSV can use a `series` column for up to six aligned series; scatter takes numeric `x`, `x_unit`, `value`, and `unit`; CDF imports raw `value` observations and computes a right-continuous empirical staircase with grouped ties. Optional slide fields include `slide_id`, `assertion_title`, `speaker_notes`, and one of four reusable layouts: `assertion-evidence`, `two-column-contrast`, `metric-focus`, `chart-and-takeaway`.

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

Windows rendering uses Microsoft PowerPoint if installed. If COM export is unavailable, open the PPTX in PowerPoint and use **File → Export → Create PDF/XPS**. Linux rendering requires LibreOffice Impress. Both paths require Poppler for PNG rendering. The preview command reports the number and paths of every page image; it does not claim to detect layout defects automatically.

## Optional AI storyboard

`npm run plan:ai` is opt-in and may incur API charges. It sends the local brief and evidence ledger to the configured OpenAI API. Do not use it with confidential research unless specifically authorized. Local build, validation, tests, and CSV import never call an AI service.

### Slide Critic and human review gate (M3)

Run the deterministic, offline critic on any editable storyboard. Reports list rule IDs, severity, slide IDs, element fields, specific suggestions, and the guidance source behind each rule:

```powershell
npm run critique -- --input examples/research-demo.json --evidence sources/evidence.json --out outputs/research-demo-critique
```

For factual statement, metric, and chart slides, add `claim_support` records that link each cited evidence ID to the exact claim, source excerpt, locator, and human review status. The Critic reports missing, pending, or contradicted records; it does not infer semantic entailment. Run `npm run evaluate:critic` to reproduce rule-level precision/recall on the 24-case hand-labeled synthetic fixture set. Those results check the review-state contract only, not expected accuracy on real presentations.

The optional AI planner accepts a target audience, goal and duration; its JSON output remains editable. It uses constrained JSON Schema, restricts citations to ledger IDs, reports numeric literals absent from the supplied brief for human checking, and writes a review checklist. The numeric check is lexical only and cannot establish semantic support or truth.

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

Import a local research source to quoted text with page/paragraph locators, source and extracted-text hashes, a manifest, and an evidence ledger entry. Source status stays `verified:false`; extraction never verifies scientific claims or uploads the file. DOCX uses the built-in `fflate` dependency. PDF import uses Poppler `pdftotext -layout` when installed and falls back to Mozilla PDF.js (`pdfjs-dist`) without network access; use `--pdf-engine pdfjs` to select PDF.js explicitly. Image-only/scanned PDFs are rejected without OCR, and PDF.js reading order may differ from the source's visual columns, so check extracted text against the rendered PDF.

```powershell
npm run import:document -- --input "D:\research\paper.docx" --id E_LOCAL_PAPER --label "Paper methods section" --evidence sources/evidence.json --out-prefix outputs/imports/paper
Get-Content outputs/imports/paper.md
```

The command writes `.md`, `.manifest.json`, and `.evidence.json` files under the selected output prefix. When an existing ledger is supplied, its entries are copied and the new unverified entry is appended to the generated ledger; the original ledger is not modified. DOCX tables are linearized, headers/footers and image OCR are not extracted. Use the generated evidence ID in a storyboard and cite the exact excerpt/locator in `claim_support`.

### Local update benchmark (synthetic)

Run a reproducible first-generation / one-row-update timing and structural fidelity check on the bundled synthetic repeated-run fixture:

```powershell
npm run benchmark:update
Get-Content outputs/m4/update-benchmark.benchmark.md
```

This measures the local CSV import, validation, PPTX build, and structural QA pipeline. It reports source diffs, evidence-ID coverage, native chart/workbook values, and editability; it does not measure human repair time or prove cross-platform office rendering quality. The recorded workstation run is in [`docs/M4_UPDATE_BENCHMARK.md`](docs/M4_UPDATE_BENCHMARK.md).

To compare the built-in themes, generate a 2-slide cover/chart preview in each theme, inspect the six PNGs, and confirm a selection explicitly. No proprietary template or asset is copied.

```powershell
npm run theme-gallery -- --input examples/research-demo.json --evidence sources/evidence.json --out outputs/theme-gallery
npm run select:design -- --gallery outputs/theme-gallery/gallery.json --theme academic-light --reviewer "Reviewer name" --confirm yes --out docs/design.md
```

The selection command writes the confirmed theme profile to `docs/design.md` and `docs/design-tokens.json`; change the theme argument to the option you actually select. A gallery alone does not mark any option as confirmed.

### Local image assets (Milestone 3A first vertical slice)

Reference local PNG, JPEG, or SVG images in an asset manifest. Paths are relative to the manifest. Every asset records its MIME/type, SHA-256, source, license, and human verification state; duplicate bytes, missing files, mismatched hashes, missing provenance, and unknown slide references fail the build. Slides use `visuals` placements with slide-relative inch coordinates. Embedded SVGs are PowerPoint image objects; their internal paths are not individually editable shapes. No asset is uploaded.

```powershell
node src/assets-cli.mjs examples/multimodal/assets.json
node src/cli.mjs validate --input examples/multimodal/storyboard.json --evidence examples/multimodal/evidence.json --assets examples/multimodal/assets.json
node src/cli.mjs build --input examples/multimodal/storyboard.json --evidence examples/multimodal/evidence.json --assets examples/multimodal/assets.json --out outputs/m3a-assets-demo.pptx
node src/qa.mjs outputs/m3a-assets-demo.pptx
```

The three-slide `examples/multimodal/` fixture is explicitly synthetic/hypothetical. It verifies local SVG embedding and lineage only; the planned 10-slide AI Systems acceptance project, raster/JPEG examples, editable architecture primitives, complete visual review, and PDF/PNG deliverables remain future work.

## Research and design rules

- Titles state the slide's point; evidence stays attached to each factual slide.
- Use editable text, shapes, and chart objects. Images are not a substitute for editable slide content.
- Keep source verification state visible. `verified:false` produces a warning and is not scientific validation.
- Preserve units, baselines, sample counts, and aggregation method. Do not infer confidence intervals or significance.
- Audience and context matter: investment-pitch guidance is not a rulebook for systems research talks.
- Third-party guidance is translated into independent checks; no copyrighted templates, fonts, or artwork are bundled.

See [`docs/PROJECT_CAPABILITIES_QA.md`](docs/PROJECT_CAPABILITIES_QA.md) for the current capability Q&A; [`docs/LOCAL_SLIDE_GUIDANCE.md`](docs/LOCAL_SLIDE_GUIDANCE.md) for an offline summary of presentation guidance by institution and use case; [`docs/REFERENCES.md`](docs/REFERENCES.md) for source links; [`docs/RESEARCH_APPLICATION_MATRIX.md`](docs/RESEARCH_APPLICATION_MATRIX.md) for source-to-code traceability; [`docs/PRODUCT_BENCHMARK.md`](docs/PRODUCT_BENCHMARK.md) for a measurement protocol; and [`docs/SCHEMA.md`](docs/SCHEMA.md) and [`docs/CODEX_MASTER_PROMPT.md`](docs/CODEX_MASTER_PROMPT.md) for data contracts and roadmap.

M4's local-source import, synthetic update-cost benchmark, open-source editable-PPTX comparison and official ecosystem capability review are documented in [`docs/M4_IMPLEMENTATION_REPORT.md`](docs/M4_IMPLEMENTATION_REPORT.md), [`docs/M4_UPDATE_BENCHMARK.md`](docs/M4_UPDATE_BENCHMARK.md), [`docs/M4_BACKEND_COMPARISON.md`](docs/M4_BACKEND_COMPARISON.md), and [`docs/M4_ECOSYSTEM_REVIEW.md`](docs/M4_ECOSYSTEM_REVIEW.md). The Slidev comparison is an optional, locally reproduced prototype and is not part of default dependencies or CI. No cloud account or provider API was connected.

## CI and repository state

GitHub Actions runs `npm ci` and `npm run check`, then uploads both PPTX outputs and QA reports. It does not use paid APIs. Local preview rendering uses installed desktop software and is not part of CI.

## Verified in this checkout

On 2026-11-12, `npm ci`, `npm run check`, and PowerPoint-to-PDF-to-PNG preview completed on this Windows checkout (Node.js 24.14.0, PptxGenJS 4.0.1, fflate 0.8.3). Manual page review covers the 7-slide research deck, the 8-slide Markdown deck, and five 8-slide CSV chart decks: bar, line, multi-series line, scatter, and ECDF. The repeated-run Student-t deck has structural QA coverage (native error-bar values equal source intervals), but its fresh pixel preview has not been manually reviewed because the PowerPoint COM renderer hung on that attempt. Other visual and QA limitations remain; the research-demo report warns because E1/E2 are unverified and its chart lacks a sample count. Synthetic fixture reports warn by design and are not empirical evidence.

## License

Project code is MIT licensed; see [`LICENSE`](LICENSE). External links are references, not permission to redistribute their copyrighted material.
