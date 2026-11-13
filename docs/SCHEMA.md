# Storyboard + Evidence contract

The canonical backend-neutral Presentation IR, Project/Profile/Job and Source/Evidence/Claim contracts are documented in [`SLIDE_IR_SCHEMA.md`](SLIDE_IR_SCHEMA.md). The storyboard format below remains supported by the legacy CLI; the IR adapter contract is in [`ADAPTER_CONTRACT.md`](ADAPTER_CONTRACT.md).

The local build is **fully offline** after dependencies are installed; AI planning is optional.

## Storyboard (`examples/research-demo.json`)

```json
{
  "meta": {
    "title": "Research talk title",
    "subtitle": "Context / author / date",
    "audience": "Research lab",
    "audience_profile": "research_group",
    "goal": "Get feedback on the next experiment",
    "duration_minutes": 7,
    "aspect_ratio": "16:9",
    "layout": "assertion-evidence",
    "theme": "academic-light",
    "status": "DRAFT — source verification pending"
  },
  "slides": [
    {"type":"cover", "kicker":"INTRO", "title":"Title", "body":["Subtitle"], "evidence_ids":[]},
    {"slide_id":"S02", "type":"statement", "layout":"two-column-contrast", "kicker":"FINDING", "title":"Claim", "assertion_title":"The slide's main claim", "body":["Supporting evidence"], "evidence_ids":["E1"], "speaker_notes":"Explain the comparison and its limitation."},
    {"type":"metrics", "kicker":"EVIDENCE", "title":"Metric interpretation", "metrics":[{"label":"Latency", "value":"0.4s", "detail":"P50, ms"}], "evidence_ids":["E1"]},
    {"slide_id":"S04", "type":"chart", "layout":"chart-and-takeaway", "kicker":"EVIDENCE", "title":"Chart takeaway", "chart":{"kind":"bar","unit":"seconds","y_axis_label":"TTFT P50 (seconds)","series_name":"TTFT P50","categories":["Raw","Compressed"],"values":[0.35,1.1]}, "evidence_ids":["E1"]},
    {"type":"process", "kicker":"METHOD", "title":"How the system works", "steps":["Input","Decode","Output"], "evidence_ids":["E2"]},
    {"type":"bullets", "kicker":"NEXT", "title":"Three next steps", "body":["First","Second","Third"], "evidence_ids":["E2"]},
    {"type":"closing", "kicker":"DECISION", "title":"What should we do?", "body":["Ask for a choice"], "evidence_ids":[]}
  ]
}
```

**The values above are purely instructional examples, not real experimental measurements.**

### Slide types

- `cover`: Hero text / optional 1–2 body lines.
- `statement`: One compelling full-sentence assertion + 0–2 supporting points.
- `metrics`: 1–4 metric cards; requires at least one evidence ID.
- `chart`: Native PowerPoint bar, line, scatter or empirical CDF chart; each requires finite data, explicit axis units/labels, and at least one evidence ID. Bar values are nonnegative and use a zero baseline; line and scatter values may be signed. Bar/line support 1–6 named series over 2–9 shared categories. Scatter uses numeric `x_values` plus one or more y series. CDF stores `raw_values` and must match the deterministic right-continuous step transform (ties grouped; cumulative count / raw n); `sample_size` equals the raw observation count.
- `process`: 2–6 steps in horizontal sequence; lengths must fit.
- `architecture` (M3A): 1+ labeled groups, 2–12 uniquely identified nodes, and directed edges with known distinct endpoints. Group/node geometry uses inches and must remain inside the slide content canvas. The renderer emits editable PowerPoint shapes, text, and connectors; the input diagram JSON remains the deterministic source.
- `table` (M3A follow-on): 2–6 column headers, 1–10 data rows and fixed-width cells emitted as a native editable PowerPoint table. Every row must match the header count; cells accept strings up to 90 characters or finite numbers. Table slides require evidence IDs. Optional caption is limited to 180 characters; table data is copied into the evidence manifest with the slide's source IDs and locators.
- `code` (M3A follow-on): supported language (`python`, `javascript`, `typescript`, `bash`, `sql`, `c`, `cpp`, `json`, `yaml`, `plaintext`), filename, 1–14 source lines up to 180 characters each, and at least one evidence ID. Lines wrap at whitespace or punctuation where possible into editable native text objects; wrap pieces preserve source characters. The display is limited to 20 visual lines. Evidence manifests retain the exact original lines, language, filename, source IDs and locators. Code is presented as text, not syntax-validated or executed.
- `timeline` (M3A follow-on): 3–6 ordered events with short `when`, `label`, and optional `detail` text. Requires evidence IDs. The renderer emits a native PowerPoint connector, markers, and editable event labels; QA checks marker count, event order, and exact text against the storyboard. Event labels are supplied as text and are not parsed as calendar dates.
- `bullets`: 1–5 ordered next steps.
- `closing`: Decision required and concrete next step.

Each `evidence_ids` item must match an entry from `sources/evidence.json`. No source ID may be silently invented or ignored.

### Europe PMC DOI full-text importer (M16 bounded adapter)

`npm run research:ingest:europepmc -- --doi 10.xxxx/example --allow-network --allow-download --out-dir <new-dir>` sends the public DOI identifier to Europe PMC, requires one exact DOI record marked open access with a `PMC` identifier, and fetches that record's JATS XML from the fixed Europe PMC endpoint. It writes the original XML, extracted Markdown, a source manifest, and paragraph-level `verified:false` evidence with section locators and hashes. Network access and full-text download require separate flags; output directories cannot already exist; redirects are rejected and responses are bounded to 20 MiB. The adapter does not download arbitrary URLs or publisher PDFs. Open-access metadata and any returned license string are recorded as provider metadata, not legal validation; `reuse_rights` remains `needs_review`. Text extraction is a lightweight paragraph parser, not a complete JATS structural conversion. The [Europe PMC REST API documentation](https://dev.europepmc.org/RestfulWebService) describes the service and its full-text access.

### Project-scoped scholarly metadata candidates (M19)

`POST /projects/{project_id}/research/search` accepts the OpenAlex/Crossref/arXiv search fields plus `allow_network:true`; the explicit flag is required before the public provider receives the query. The bounded unverified records are saved in the local workspace database with provider record ID, search query, retrieval timestamp, response hash and metadata. `GET /projects/{project_id}/research/candidates` lists them. `POST /projects/{project_id}/research/candidates/{source_id}/import` registers exactly one saved result under `source_ir.sources` as type `scholarly-metadata-candidate`, preserving its metadata and `verification_status:"unverified"`. This action creates no `source_ir.evidence` or claims. Search data is untrusted provider metadata; a record hash is integrity metadata, not proof of truth or peer review. See `docs/M19_PROJECT_RESEARCH_CANDIDATES_REPORT.md`.

### User-supplied evidence excerpts (M20)

`POST /projects/{project_id}/evidence` accepts an `evidence_id` (up to 128 characters), a known `source_id`, exact user-supplied `excerpt` text (1–10,000 characters), and an optional `locator` (up to 1,000 characters). Excerpt whitespace is preserved. The API writes a `source_ir.evidence[]` record with `verification_status:"pending"`, `reviewer:null`, and `reviewed_at:null`; any caller-supplied verification status is ignored. Unknown source IDs and duplicate IDs are rejected. `GET /projects/{project_id}/evidence` lists the records. The API does not retrieve external sources, infer claim support, or mark evidence/source/claims verified. For imported local source bytes it may compute the bounded exact-match result described below.

For sources imported through this local API, evidence responses also include a computed `source_match`. Exact matching supports imported UTF-8 `.txt`, `.md`, `.markdown`, `.csv`, `.json`, `.yaml`, `.yml`, `.xml`, `.html`, `.htm` and `.log` files, plus selectable-text `.pdf` and `.docx` files up to 20 MiB. PDF/DOCX use the existing offline PDF.js and DOCX extractors and report the matching page/paragraph locator; no OCR is run. Results are `exact_match`, `no_exact_match`, or `unavailable`; they include the immutable source hash and, on match, an offset within the matched text block, occurrence count and extracted locator. Unsupported, unimported, oversized, malformed or non-UTF-8 sources report a reason. This is a verbatim provenance check against raw text or extracted text, does not assess claim entailment, and never changes evidence/source verification status. Text normalization and OCR matching are not attempted.

### Human evidence excerpt review (M21)

Evidence list/create responses include `content_sha256`, computed from the stable JSON tuple `{evidence_id,source_id,excerpt,locator}`. `POST /projects/{project_id}/evidence/{evidence_id}/review` accepts `{reviewer,decision,content_sha256,note?}`, where decision is `verified` or `contradicted`. The exact current excerpt hash is required; stale/mismatched hashes and already-final decisions return conflict. The service records the caller-supplied reviewer, timestamp and reviewed hash. This is an auditable human assertion about the excerpt; the service has no user authentication and the review endpoint does not judge whether a claim follows from the excerpt. Evidence responses separately include the bounded local `source_match` check documented above. A review never changes the parent source's verification state. See `docs/M21_EVIDENCE_REVIEW_REPORT.md`.

When a Presentation IR update changes the excerpt, source ID, or locator for a reviewed evidence ID, the previous final decision is retained as audit history (`stale_review_decision`, reviewer, timestamp and prior reviewed hash), but current `verification_status` returns to `pending` and `review_stale` is set. A reviewer must decide again using the newly returned `content_sha256`; successful re-review clears the stale marker.

### Local image assets (M3A first vertical slice)

An optional `--assets <manifest.json>` can accompany `validate` and `build`. Manifest paths resolve relative to the manifest file. Each `assets[]` entry requires a unique `asset_id`, `path`, exact `type` and `mime_type` (`image/png`, `image/jpeg`, or `image/svg+xml`), matching file `sha256`, nonempty `source` and `license`, and boolean `verified`. Duplicate file hashes, missing files, invalid MIME/type pairs, and stale hashes are errors. `verified:false` means provenance/permission has not received human confirmation; a syntactically valid license string is not legal validation.

Slides may contain `visuals:[{"asset_id":"A1","x":7.1,"y":2.3,"w":5.2,"h":2.5}]`; geometry uses inches on the 13.333 × 7.5 slide canvas. Unknown asset IDs and out-of-bounds placements fail. Optional asset `description`, `alt_text`, `title`, and `keywords[]` provide text for the deterministic usage-suggestion report. Run `npm run assets:suggest -- --storyboard <storyboard.json> --assets <manifest.json> --out <new-report.json>` to rank candidates by lexical overlap with slide title/assertion/body/notes and those asset fields; the report includes matched terms and provenance/rights flags. It never adds a placement or marks rights verified, and it is not semantic image recognition, claim entailment, or legal review. SVGs are embedded as picture objects and can be replaced/cropped/resized as one object; their vector primitives are not native editable PowerPoint shapes. With no asset manifest, existing decks build as before. CLI builds copy asset hash, provenance, verification state, and associated slide IDs into the evidence manifest.

`node src/import-document.mjs --input source.docx|source.pdf --id E_LOCAL_SOURCE --extract-images --out-prefix outputs/imports/source` optionally extracts supported DOCX body/header/footer PNG/JPEG/SVG parts or decodes PDF inline images and image XObjects to PNG. It writes `source.assets.json` plus local asset files, accepted by `validate`/`build --assets`. DOCX body text and paragraphs in referenced headers/footers are extracted with distinct locators; only sections referenced by the main document relationships are included. DOCX source part and relationship IDs, alt text when present, PDF page/operator locators (and inline-group placement counts), source and image hashes, and inherited `verified:false` rights state are retained. Duplicate image bytes are emitted once. PDF decoding does not preserve original compressed image streams; masks/soft masks and uncommon sample formats are not supported. DOCX tables are linearized, while comments and tracked-deletion semantics are not extracted. Extraction does not infer figure meaning, verify licensing, or add slide placements. External and path-escaping DOCX relationships are ignored. The asset loader rejects SVG documents containing scripts, event handlers, document types/entities, or external/data references before embedding.

### Selected Wikimedia Commons batch import (M17 bounded adapter)

`node src/asset-research.mjs download-batch --results <commons-search.json> --selection <selection.json> --out-dir <new-dir> --allow-download` accepts a user-authored `{"items":[{"source_id":"WMC_...","asset_id":"A_..."}]}` selection. Every ID must resolve to the supplied search result; duplicate source/asset IDs, missing candidates, unsupported media, or duplicate bytes fail. The batch is sequential and limited to five images and 50 MiB total; each image is separately capped at 25 MiB and only PNG/JPEG from Wikimedia upload hosts are accepted. The `assets.json` manifest preserves source/description-page URL, declared license and author/credit metadata, source-record hash, download URL and file hash. All rights remain `needs_human_review`, and a license label is not legal verification. No files are downloaded before explicit `--allow-download`.

### QA and page-by-page visual review

`src/qa.mjs <deck.pptx>` emits machine-checkable findings separately from per-slide subjective review prompts. Machine checks include bounds for text, shape, picture, chart-frame, and connector objects; overlapping text-box rectangles; non-footer text below 9.5 pt; theme token contrast; missing chart labels; native chart/workbook values; and source IDs. Object overflow and overlap are findings for review because decorative bleed or intentional layering is possible. Font availability/substitution is a risk prompt, not an assertion inferred from PPTX XML. Human prompts cover fit, connectors, chart legibility, and whether visuals support the assertion.

`node scripts/preview.mjs <deck.pptx> [--renderer auto|powerpoint|libreoffice]` writes a SHA-256-bound `.preview.json` only after PDF and all page PNGs render. Automatic mode tries PowerPoint COM on Windows then LibreOffice; other platforms use LibreOffice. QA only recognizes render images when the preview manifest's PPTX hash matches the deck. After inspecting every rendered page, record one decision per slide: `node src/visual-review.mjs --pptx outputs/demo.pptx --reviewer "Name" --slide S01 --decision approve --note "Checked text, image and layout at presentation size"`. Decisions are stored in `.visual-review.json`, bound to the PPTX hash, and stale decisions cannot approve changed content. Review status remains pending or render-blocked until every page is rendered and recorded.

### Claim-to-source review records (M3)

Factual `statement`, `metrics`, and `chart` slides can record one `claim_support` entry per cited source ID:

```json
{"evidence_id":"E1","claim_text":"The assertion shown on this slide","source_excerpt":"Exact excerpt or table cell checked by the reviewer","locator":"report.pdf, page 4, Table 2, row 3","review_status":"pending"}
```

`claim_text` must match `assertion_title` (or the slide title when absent). `review_status` is `pending`, `verified`, or `contradicted`. A verified record also requires `reviewer` and ISO-parsable `reviewed_at`. The Critic flags a missing mapping (`CLAIM-001`), a pending comparison (`CLAIM-002`), or a recorded contradiction (`CLAIM-003`). These checks enforce provenance and review state; they do not determine whether the excerpt semantically entails the claim. Source-level `verified:false` warnings remain independent and visible.

`npm run evaluate:critic` evaluates the three claim-review state rules against 24 hand-labeled synthetic fixtures and writes `docs/CRITIC_EVALUATION.md` plus JSON. These are contract tests, not estimates of real-deck accuracy.

### Local run-audit CSV (separate from slide import)

`src/run-audit.mjs` accepts local CSV with required columns `run_id`, `run_timestamp`, and `observation_id`. Timestamps must be ISO date-times and identical for every row sharing a run ID; observation IDs must be unique within each run. Other columns are preserved as values and contribute to per-row SHA-256 hashes. The audit manifest also hashes the exact source bytes. A later manifest can be compared with an earlier JSON report to identify added, changed, and removed `(run_id, observation_id)` pairs. This is an integrity/change report, not a statistical analysis or validation of scientific meaning. Source row numbers are informational and may change after row reordering.

`src/refresh-runs.mjs <run-summary.csv> <deck.pptx> [baseline-refresh.json] [manual-repair-minutes]` combines the local repeated-run importer, source diff, storyboard validation, deck build and structural QA. Its `.refresh.json` and `.refresh.md` reports retain source/run hashes, diff counts and rows, QA path, first/subsequent local pipeline time, PPTX hash, and optional operator-measured repair time. With unchanged input, it skips deck rebuilding. Pipeline time excludes PDF/PNG rendering and human visual review; repair time is never inferred by automation. This is not an authenticity check.

`src/build-dual.mjs <storyboard.json> [evidence.json] [output-prefix]` validates one source graph and creates `-talk` and `-reading` decks. Talk keeps the authored slides. Reading appends cited evidence records, chart method summaries and deterministic chart-data pages, preserving the same cited IDs and graph hash. It does not generate scientific claims or values.

### Repeated-run summary CSV

`src/import-repeated.mjs` requires `run_id,run_timestamp,observation_id,condition,metric,value,unit`. Each row is one pre-aggregated value from an independent run. The current implementation is unpaired: `run_id` and `observation_id` must be unique across the file; paired/repeated-measures designs are rejected by this contract. There must be one metric and unit, 2–9 conditions, and at least 10 runs per condition. Empty/nonfinite values, missing identifiers, and timestamps without a timezone are errors.

For each condition, the importer computes the sample mean and two-sided 95% Student-t confidence interval, `mean ± t(0.975, n−1) × s/√n`. It assumes independent, approximately normal run-level values; the minimum n is a product guardrail, not a guarantee that the approximation is adequate. Review distributions, drift and protocol comparability. The interval describes uncertainty in the condition mean; it is not a test of the difference between conditions and does not imply causality or statistical significance. Each summary retains raw run values, run IDs, observation IDs and CSV row locators. PptxGenJS emits the editable chart; a post-build DrawingML step adds its native custom error bars. QA checks cached means, embedded workbook values and exact error-bar values against the storyboard. Synthetic fixtures demonstrate mechanics only.

`slide_id` is optional for legacy decks and should be stable (`S01`, `S02`, …) for maintained decks. Chart y-axis labels and units are required; scatter/CDF also require x-axis units/labels. Missing sample counts warn for bar/line charts. CDF raw observation count is mandatory. Bar charts must begin at zero. Only 16:9 is currently supported. `speaker_notes` is copied to PowerPoint speaker notes.

### Evidence ledger (`sources/evidence.json`)

```json
{
  "entries": [{
    "id": "E1",
    "label": "Experiment report / table name",
    "source": "Local report or reliable URL",
    "locator": "Filename + page/row/commit hash",
    "verified": false,
    "note": "What must be checked"
  }]
}
```

`verified` is a human-maintained flag. It should only be changed to `true` after the cited material has actually been compared with source data. The software does not currently perform factual verification.

### M3 deterministic Slide Critic and review state

Run `src/critique.mjs --input storyboard.json [--evidence evidence.json] [--out report-prefix]` to write `.json` and `.md` reports. Each finding includes a stable rule ID, severity, slide ID (or `DECK`), element field, recommendation, and guidance source. Rules check audience/goal/duration metadata, profile-specific research methods/limitations or investment risks/decisions, claim/evidence framing, source verification state, chart sample counts and descriptions, and long copy. Results are prompts for human review, not scores or proof of scientific validity.

Charts may include `figure_description` (1–550 characters); the renderer adds it to speaker notes for readers who cannot interpret the chart visually. It does not infer alt text from chart values. For a script-based delivery estimate, explicitly set `speaker_notes_are_script:true`, `speech_rate_words_per_minute`, `duration_minutes`, and (when supplied by the venue) an ordered `[min,max]` `timing_window_minutes`. The Critic reports estimated minutes and only flags an out-of-window script against the provided venue window. It does not apply a universal slide/minute rule.

The optional `src/ai-plan.mjs` path requests schema-constrained slide JSON and is an explicit API call. Generated content is marked `requires_human_review:true`. A lexical numeric-token check flags numbers absent from the supplied brief, but does not detect all hallucinations or verify semantic support. `src/review-draft.mjs` writes a separate approved/rejected editable copy and records reviewer, note, date, cited critic rules and a content SHA-256. Building an AI draft requires approval, an explicit acknowledgement of the critic findings, and a matching content hash; edits after review invalidate the approval.

`src/theme-gallery.mjs` makes a cover+chart preview in all three bundled themes. Review each rendered PNG, then `src/select-design.mjs` can write an explicitly reviewer-confirmed Markdown design profile and token JSON. Generating the gallery alone does not constitute a selection.

### AI storyboard format

The optional planner emits a schema-constrained draft with `{title, subtitle, narrative_structure, structure_rationale, slides}`. Each slide includes an assertion, one supported layout, evidence IDs, `visual_needs`, and `speaker_notes`. Visual needs are planning suggestions; this planner does not download or create assets and does not construct chart values. It emits only `cover`, `statement`, `bullets`, `closing`; manually add native charts, metrics, architecture, process, tables, code, or timelines after source review. Local validation rejects unknown evidence IDs, source `verified` state is never changed, and the draft stays behind `requires_human_review:true` until an explicit content-hash-bound reviewer decision. The API call is opt-in; local validation and the deterministic storyboard path do not require an API key.

## Styling

Themes are JSON files in `themes/` with colors as six-digit RGB hex strings and font families. Change `meta.theme` or override with `--theme`.

## Warnings vs errors

- **Errors:** missing title, invalid type, malformed data, unknown source ID, numerical chart without evidence.
- **Warnings:** long body text, unsupported verification status, uncited assertions on non-cover pages.
- **Not fully detected:** font substitution on the final playback system, text clipped within an otherwise in-bounds shape, numerical disagreement with the original source, and statistical invalidity. Structural bounds/overlap checks and theme contrast warnings are machine-reported; rendered appearance and scientific adequacy still need human review.
