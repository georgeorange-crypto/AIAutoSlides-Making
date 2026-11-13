# Canonical Slide IR 1.0.0

Machine-readable structural schema: [`../packages/contracts/presentation.schema.json`](../packages/contracts/presentation.schema.json). Runtime semantic checks: `packages/core/validate-presentation.mjs`. The schema describes shape; runtime validation enforces cross-object relationships the JSON Schema cannot express conveniently.

## Domain objects

| Object | Required identity / meaning |
|---|---|
| `DeckIR` | `schema_version`, `meta`, ordered `slides`, and `source_ir`. Stable deck identity is optional for legacy migration. |
| `Source` | `source_id`, source type, URI/path, optional SHA-256/locator, and `verification_status`. `unverified`, `pending`, and `contradicted` remain visible. |
| `Evidence` | `evidence_id`, parent `source_id`, short excerpt, locator and verification state. Presentations may cite a legacy source ID or distinct evidence ID; a distinct evidence record must resolve to a source. |
| `Claim` | `claim_id`, statement, `evidence_ids` and review status; unknown evidence/source references fail validation. A renderer never promotes a pending or contradicted claim. |
| `SlideIR` | Stable `slide_id`, renderer-neutral `type`, title/takeaway, cited source IDs, elements, optional audience/time/design intent and speaker notes. |
| `Element` | Stable `element_id`, semantic `kind`, optional source IDs and typed content. Element provenance inherits slide citations only when omitted. |
| `Asset` | Stable asset ID, source/hash, media type, license/rights and review status. An asset never becomes licensed merely because a path exists. |
| `RunManifest` | Run ID/status/times, input and output paths/hashes, tool/version/status records, policy and warnings. |

## Rules

- IDs must be unique within their object collection and every cited source ID must exist in `source_ir.sources`.
- Distinct evidence records and claims are supported under `source_ir.evidence[]` and `source_ir.claims[]`; each evidence record must resolve to a source. Legacy presentations that used the source ID directly as a citation remain supported.
- Every factual slide needs an evidence reference. Every chart needs its own source reference, both axis descriptions, aligned finite values and a supported chart type.
- Numerical figure values come only from structured input data. Prose generation cannot populate chart series.
- `verification_status: verified` is a recorded review state, not an automatic conclusion from extraction or hashing.
- Unsupported element kinds are errors for a selected adapter; they must not be silently omitted.
- `image` elements require a declared local asset, descriptive `alt`, and positive `x/y/w/h` geometry within the 16:9 canvas. PptxGenJS verifies workspace containment, symlinks, size, MIME and SHA-256 before embedding. Restricted rights fail; pending/unknown rights remain warnings.
- `process` elements require 2–6 titled steps. PptxGenJS maps supported process groups to editable objects; Slidev maps them to HTML layout elements and may rasterize them in PPTX export.
- `diagram` architecture elements require 2–12 specifically named nodes, at least one connected edge, and an action-verb relationship label on each edge. The planner applies a stricter 3–6 node and 2–6 edge range. Runtime checks use a small multilingual action vocabulary and catch generic placeholders; they cannot prove a relation is true or complete.
- `mermaid` elements remain canonical source text. The PptxGenJS adapter converts a bounded acyclic flowchart subset (`flowchart`/`graph`, TD/TB/BT/LR/RL, plain node labels/shapes and directed labeled edges) into native editable PowerPoint shapes/connectors. Unsupported syntax, cycles, or layouts above 12 nodes, 24 edges, four layers or four nodes per layer fall back to editable source text with a visible warning. The full Mermaid language is not supported; Slidev may still rasterize Mermaid.
- Structured diagram nodes may use `rect`, `roundRect`, or `diamond`; omitted shapes keep the renderer's rounded-rectangle default.
- Backends may declare lower editability than requested only by returning a warning/failure that identifies the affected elements.

## Migration

`packages/contracts/migrate.mjs` retains legacy source IDs, notes, slide order and source links when converting the existing storyboard/evidence files. Migration does not verify any source. The legacy CLI remains supported; new integrations should consume the versioned IR.
