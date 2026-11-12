# AIAutoSlides Making

Evidence-first, offline-by-default generation of editable PowerPoint research talks. The local pipeline uses Node.js and PptxGenJS; it does not require an AI key or cloud service.

> The included KV-cache example contains user-supplied, **unverified** values. Treat its charts and claims as drafts until checked against original experiment logs. The CSV teaching workflow is explicitly **synthetic** and is not research evidence.

## Quick start — Windows PowerShell

Requirements: Node.js 20+, npm, and PowerPoint or LibreOffice for PDF export. Poppler (`pdftoppm`) is needed for page PNGs.

```powershell
cd D:\OPPitems\HOMEWORK\Liberty\AIAutoSlides
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

### Native line chart (Milestone 2 first step)

The same deterministic importer can create an editable PowerPoint line chart from a synthetic ordered series:

```powershell
npm run from:line
node src/cli.mjs validate --input outputs/synthetic-line/storyboard.json --evidence outputs/synthetic-line/storyboard-evidence.json
node src/cli.mjs build --input outputs/synthetic-line/storyboard.json --evidence outputs/synthetic-line/storyboard-evidence.json --out outputs/synthetic-line-demo.pptx
node src/qa.mjs outputs/synthetic-line-demo.pptx
node scripts/preview.mjs outputs/synthetic-line-demo.pptx
```

Line values may be signed; bar values must be nonnegative and start at zero. This step uses synthetic values. Scatter, CDF, waterfall, multi-series, and repeated-run uncertainty displays remain future work.

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

## Themes and local rendering

Theme tokens live in `themes/*.json`; current options are `academic-light`, `tech-dark`, and `keynote-minimal`. Themes use installed fonts only; check font substitution on the actual presentation machine.

Windows rendering uses Microsoft PowerPoint if installed. If COM export is unavailable, open the PPTX in PowerPoint and use **File → Export → Create PDF/XPS**. Linux rendering requires LibreOffice Impress. Both paths require Poppler for PNG rendering. The preview command reports the number and paths of every page image; it does not claim to detect layout defects automatically.

## Optional AI storyboard

`npm run plan:ai` is opt-in and may incur API charges. It sends the local brief and evidence ledger to the configured OpenAI API. Do not use it with confidential research unless specifically authorized. Local build, validation, tests, and CSV import never call an AI service.

## Research and design rules

- Titles state the slide's point; evidence stays attached to each factual slide.
- Use editable text, shapes, and chart objects. Images are not a substitute for editable slide content.
- Keep source verification state visible. `verified:false` produces a warning and is not scientific validation.
- Preserve units, baselines, sample counts, and aggregation method. Do not infer confidence intervals or significance.
- Audience and context matter: investment-pitch guidance is not a rulebook for systems research talks.
- Third-party guidance is translated into independent checks; no copyrighted templates, fonts, or artwork are bundled.

See [`docs/RESEARCH_APPLICATION_MATRIX.md`](docs/RESEARCH_APPLICATION_MATRIX.md) for source-to-code traceability, [`docs/PRODUCT_BENCHMARK.md`](docs/PRODUCT_BENCHMARK.md) for a measurement protocol, [`docs/SCHEMA.md`](docs/SCHEMA.md), and [`docs/CODEX_MASTER_PROMPT.md`](docs/CODEX_MASTER_PROMPT.md) for the roadmap.

## CI and repository state

GitHub Actions runs `npm ci` and `npm run check`, then uploads both PPTX outputs and QA reports. It does not use paid APIs. Local preview rendering uses installed desktop software and is not part of CI.

## Verified in this checkout

On 2026-11-12, `npm ci`, `npm run check`, and PowerPoint-to-PDF-to-PNG preview completed on this Windows checkout (Node.js 24.14.0, PptxGenJS 4.0.1, fflate 0.8.3). Manual page review covers the 7-slide research deck, the 8-slide Markdown deck, and five 8-slide CSV chart decks: bar, line, multi-series line, scatter, and ECDF. Structural QA confirms text bounds, source IDs, native chart objects, theme contrast, exact chart-cache/workbook values, and the raw-observation-to-ECDF transform. The first review caught low-contrast dark chart axes; the current render uses theme-colored axis labels. QA cannot detect every font, overlap, or clipping problem, so presentation-machine review is still required. The research-demo report intentionally remains `warning` because E1/E2 are unverified and its chart lacks a sample count. Synthetic fixture reports warn by design and are not empirical evidence.

## License

Project code is MIT licensed; see [`LICENSE`](LICENSE). External links are references, not permission to redistribute their copyrighted material.
