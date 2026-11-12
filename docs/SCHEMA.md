# Storyboard + Evidence contract

The local build is **fully offline** after dependencies are installed; AI planning is optional.

## Storyboard (`examples/research-demo.json`)

```json
{
  "meta": {
    "title": "Research talk title",
    "subtitle": "Context / author / date",
    "audience": "Research lab",
    "theme": "academic-light",
    "status": "DRAFT — source verification pending"
  },
  "slides": [
    {"type":"cover", "kicker":"INTRO", "title":"Title", "body":["Subtitle"], "evidence_ids":[]},
    {"type":"statement", "kicker":"FINDING", "title":"Claim", "body":["Supporting evidence"], "evidence_ids":["E1"]},
    {"type":"metrics", "kicker":"EVIDENCE", "title":"Metric interpretation", "metrics":[{"label":"Latency", "value":"0.4s", "detail":"P50, ms"}], "evidence_ids":["E1"]},
    {"type":"chart", "kicker":"EVIDENCE", "title":"Chart takeaway", "chart":{"kind":"bar","unit":"seconds","series_name":"TTFT P50","categories":["Raw","Compressed"],"values":[0.35,1.1]}, "evidence_ids":["E1"]},
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
- `chart`: Native PowerPoint bar chart; requires 2–9 nonnegative numeric values and at least one evidence ID.
- `process`: 2–6 steps in horizontal sequence; lengths must fit.
- `bullets`: 1–5 ordered next steps.
- `closing`: Decision required and concrete next step.

Each `evidence_ids` item must match an entry from `sources/evidence.json`. No source ID may be silently invented or ignored.

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

### AI storyboard format

The optional planner emits a restricted root `{title, subtitle, slides}` which is normalized at build time. It emits only `cover`, `statement`, `bullets`, `closing`; manually add numeric charts/metrics after evidence review.

## Styling

Themes are JSON files in `themes/` with colors as six-digit RGB hex strings and font families. Change `meta.theme` or override with `--theme`.

## Warnings vs errors

- **Errors:** missing title, invalid type, malformed data, unknown source ID, numerical chart without evidence.
- **Warnings:** long body text, unsupported verification status, uncited assertions on non-cover pages.
- **Not yet detected:** PowerPoint font substitution, clipped text/objects, numerical disagreement with original source, statistical invalidity. These need preview + human checking.
