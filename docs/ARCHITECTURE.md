# AIAutoSlides architecture — Phase 1 slice

Status: incremental implementation. The legacy storyboard/CLI stays the compatibility route. `Presentation IR 1.0.0` is the shared boundary for new render adapters. The first vertical slice validates IR, converts it to the legacy deterministic data model, renders through PptxGenJS, and writes provenance beside the deck. Slidev remains an optional independent renderer with its own capability limits.

## Boundaries

```text
Storyboard CLI (legacy) ────────────────┐
                                        ├─ validate evidence + data
Presentation IR ─ core validator/mapper ┘
                   │
           local adapter registry
              ├─ PptxGenJS (native PPTX)
              └─ Slidev (HTML/SVG/PPTX; per-object limitations)
                   │
          project workflow/API + SQLite
                   │
       artifact + source/run manifests
                   │
       OOXML QA → PDF/PNG → human review
```

- Core owns IDs, provenance, source verification state, deterministic data mapping, and policies. A renderer cannot upgrade evidence status.
- Adapters own format-specific conversion and rendering. Each reports its version, execution boundary, capabilities, warnings, artifacts and hashes.
- External model/API calls are outside the default build. Any future network adapter needs a separately enabled policy and explicit data disclosure.
- The Phase 1 runtime includes a loopback REST API, local SQLite project/job metadata, content-addressed source blobs, owner-scoped API access when a trusted authenticator is injected, per-user IR/source blob namespaces, per-job input snapshots, a bounded single-process scheduler and queued-job recovery. The CLI/default API principal remains the backward-compatible `local` user.
- User files and renderer inputs are data, not executable instructions. Imported originals are copied by SHA-256 and never overwritten; authenticated source uploads use bounded request bodies rather than server filesystem paths. Adapter workspaces and output directories are explicit.
- This is not yet a remote multi-user deployment: no built-in identity provider, OS-level worker sandbox or distributed queue is included, and the service remains loopback-only.

## Implemented slice

1. Validate IR structure and semantic invariants, especially unique IDs, all source references, chart shape and finite numeric values.
2. Preserve source verification state and union slide/element source IDs during backend mapping.
3. Render supported elements through existing PptxGenJS logic; fail closed for unsupported elements instead of silently dropping content.
4. Emit a source lineage manifest, adapter report and hash-addressed run record.
5. The local job workflow inventories evidence, derives deterministic takeaway/evidence and visual capability plans, renders, previews through PowerPoint/Poppler, runs structural QA and records export/artifact state.
6. Inspect PPTX structure and source mapping with existing QA. Scientific accuracy remains unassessed and visual approval remains a separate human decision tied to the deck hash.

See [`SLIDE_IR_SCHEMA.md`](SLIDE_IR_SCHEMA.md), [`ADAPTER_CONTRACT.md`](ADAPTER_CONTRACT.md), and [`SECURITY_MODEL.md`](SECURITY_MODEL.md) for exact contracts.
