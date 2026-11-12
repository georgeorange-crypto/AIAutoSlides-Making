# Workflow Specs (routing contract)

These six specs define the intended route and its safe fallback. They are specifications, not claims that each route is already executable. The existing storyboard/evidence → PptxGenJS route remains the usable default.

| Workflow | Inputs and route | Outputs | Failure/fallback |
|---|---|---|---|
| `research` | Local paper/data/repository → Docling or current PDF/DOCX importer → evidence ledger → deterministic planner → native charts/diagram adapter → PptxGenJS → local renderer/QA | Evidence-linked PPTX, PDF/PNG previews, speaker notes and run manifest | Missing parser falls back to current local text importer where supported; missing renderer leaves PPTX plus explicit blocked preview; unresolved claims remain unverified. |
| `pitch` | Brief + approved brand assets/template → planner → optional authorized asset/provider adapters → chosen primary backend → review | Editable deck, asset rights manifest, notes and export report | Default local-only; no account/API call without explicit provider config and approval; use native backend if full-deck service unavailable. |
| `modify-existing` | Immutable source PPTX + change request → inspect slide/master/media → stable slide/element targeting → pptx-automizer or Office host → before/after visual and OOXML diff | New PPTX, change log, untouched-page comparison | Never overwrite source; unsupported object or failed preservation blocks edit or requires explicit rebuild/review. No silent flattening. |
| `technical-html` | Markdown/code/data → Quarto, Slidev or Marp backend → browser render → PDF/HTML; PPTX only when requested | HTML/PDF and optional PPTX with editability report | Preserve backend source; report raster/partial objects. Existing native PPTX path is fallback if editability is mandatory. |
| `update-data-deck` | New source table + previous deck/template → deterministic transform and hash diff → native chart/text replacement → QA | Versioned PPTX, source diff, lineage and update report | Missing/changed schema blocks update; preserve previous deck and report changed/removed rows; no scheduled publishing by default. |
| `multiengine` | Approved plan + identical evidence-bounded content contract → isolated independent backends → per-backend QA and comparison → one selected primary | Separate variants, comparison report, one authoritative editable source deck | No cross-engine PPTX page splicing by default; incompatible editability/lineage disqualifies a backend. |

All routes inherit policy gates: local-only unless opted in, no paid calls by default, source and asset provenance retained, AI text marked draft, bounded retries, and no unknown evidence identifiers.
