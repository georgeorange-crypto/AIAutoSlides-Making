# Storyboard + Evidence contract

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
- `bullets`: 1–5 ordered next steps.
- `closing`: Decision required and concrete next step.

Each `evidence_ids` item must match an entry from `sources/evidence.json`. No source ID may be silently invented or ignored.

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

The optional planner emits a restricted root `{title, subtitle, slides}` which is normalized at build time. It emits only `cover`, `statement`, `bullets`, `closing`; manually add numeric charts/metrics after evidence review.

## Styling

Themes are JSON files in `themes/` with colors as six-digit RGB hex strings and font families. Change `meta.theme` or override with `--theme`.

## Warnings vs errors

- **Errors:** missing title, invalid type, malformed data, unknown source ID, numerical chart without evidence.
- **Warnings:** long body text, unsupported verification status, uncited assertions on non-cover pages.
- **Not yet detected:** PowerPoint font substitution, clipped text/objects, numerical disagreement with original source, statistical invalidity. These need preview + human checking.
