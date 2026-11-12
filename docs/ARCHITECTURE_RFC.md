# RFC: backend-neutral scientific presentation platform

**Status:** Incremental implementation. A Slidev Markdown exporter and a bounded Presentation IR mapping slice are available; native chart parity, asset/layout coverage, and other backends remain proposed.

## Design goal

Keep evidence validation, scientific data mapping, review state, and output QA in AIAutoSlides. Treat slide renderers and content extraction tools as independently versioned backends behind a stable intermediate representation (IR). A backend must not silently convert pending evidence into verified claims.

## Presentation IR (v1 proposal)

```json
{
  "ir_version": "1.0",
  "sources": [{"source_id":"SRC01","uri":"local://...","sha256":"...","media_type":"...","locator":"...","trust":"untrusted"}],
  "evidence": [{"evidence_id":"E1","source_id":"SRC01","claim":"...","locator":"...","verified":false,"review_state":"pending"}],
  "assets": [{"asset_id":"A1","uri":"...","sha256":"...","license":"...","verified":false,"kind":"image"}],
  "narrative": {"title":"...","audience":"...","goal":"...","duration_minutes":7,"status":"draft"},
  "slides": [{"slide_id":"S01","kind":"chart","assertion":"...","content":{},"evidence_ids":["E1"],"asset_ids":[],"layout_intent":{"family":"chart-and-takeaway","density":"talk"},"speaker_notes":"...","design_tokens":{}}],
  "figures": [{"figure_id":"F1","kind":"line","data_ref":"SRC01#rows","unit":"ms","mapping":{"x":"load","y":"latency"},"uncertainty_ref":null}],
  "design_tokens": {"theme_id":"keynote-minimal","aspect_ratio":"16:9"},
  "outputs": {"pptx":true,"pdf":false,"html":false,"native_charts":true,"notes":true,"source_manifest":true}
}
```

Identifiers are stable across generated formats. Figure values are typed and data-backed; an LLM may draft narrative text but may not supply figure values. Source/evidence/asset locators and verification state remain in a sidecar manifest even when a backend has no native field for them.

## Adapter contract

Each backend is a separate package/process, pinned by version or image digest:

```ts
interface PresentationBackend {
  id: string;
  capabilities(): Promise<{
    formats: string[]; editableObjects: string[]; nativeCharts: boolean;
    importsExistingDecks: boolean; notes: boolean; offline: boolean;
  }>;
  render(input: { irPath: string; outputDir: string; options?: object }): Promise<{
    artifacts: Array<{ kind: 'pptx'|'pdf'|'png'|'html'; path: string; sha256: string }>;
    warnings: string[]; backendVersion: string;
  }>;
}
```

The host validates IR, stages only user-authorized local content, invokes an adapter via CLI or local service, then checks artifacts with ZIP/XML inspection, text/shape/chart extraction, slide count, manifest comparison, and rendered-page QA. No adapter gets a network or credential by default. Network-capable AI generation requires an explicit provider configuration and a separate opt-in command.

## Recommended boundaries

- **Core:** schema, source/evidence ledger, deterministic data transforms, IR, human review gate, backend registry, output QA.
- **Render adapters:** existing PptxGenJS (default); Slidev CLI; Presenton service; PPTAgent Skill/runtime. Each has independent dependencies and lifecycle.
- **Ingestion adapters:** existing PDF/DOCX import; Docling or MarkItDown; python-pptx for read-only deck extraction. Keep extraction separate from scientific validation.
- **Figure adapters:** Vega-Lite for data-driven visual definitions; Mermaid/ELK for diagrams; draw.io for user-edited diagrams. Raster or vector fallback must be reported.
- **Skills/MCP:** agent-facing orchestration can call the same local CLI and adapter contracts; no backend receives evidence authority.

## Integration sequence

1. **Partially implemented:** `packages/adapters/slidev-ir.mjs` maps Presentation IR 1.0.0 text, bullets, tables, cards, callouts, Mermaid, and an SVG chart fallback to Slidev Markdown. It preserves source state, slide/evidence IDs, element/source mappings, and hashes. Windows POC generated PPTX/PDF/PNG with Slidev 53.1.0 using `networkidle`; structural and lineage checks passed. The chart remains non-native. Asset placement, arbitrary transforms, and full schema/figure coverage remain open.
2. Add capability discovery and per-backend manifest adapter without changing the default.
3. **Implemented as a first adapter slice for Slidev Markdown input and a bounded IR POC:** `packages/adapters/slidev.mjs` plus `scripts/run-slidev-backend.mjs` emits editable PPTX/PDF/PNG, hashes outputs, and validates optional lineage against every PPTX notes slide. Markdown-only evidence is under `artifacts/open-source-bakeoff/slidev-adapter/`; IR export, object QA, and visual review are under `artifacts/open-source-bakeoff/slidev-ir/`. Native chart objects, asset/layout parity, and existing-deck import remain open acceptance items.
4. Add Presenton only if fixed-content API can run without a paid provider and output provenance can be reconstructed.
5. Add PPTAgent Skill as an optional agent workflow; route fully offline/static scaffolding separately from LLM-driven generation.
6. Promote a backend only after repeated synthetic and user-authorized corpus tests show layout, editability, scientific fidelity, and operating-cost acceptability.

## Non-goals / open questions

The IR does not encode arbitrary CSS, every PPTX animation, or exact PowerPoint geometry. Round-trip editing remains backend-specific. Whether an editable browser export preserves native chart data must be demonstrated, not inferred from selectable text. PPTX object capability should be reported per slide, not only as a deck-level boolean.
