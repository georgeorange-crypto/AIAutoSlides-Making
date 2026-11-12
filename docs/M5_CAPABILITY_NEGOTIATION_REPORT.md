# Adapter Negotiation and Shared Slidev IR Validation

## Delivered

- Added `negotiateAdapterCapabilities()` to the adapter protocol. Both legacy tool adapters and Presentation IR adapters expose `adapter.negotiate(request)`.
- Negotiation checks requested output formats and required capability values against the live adapter report. Unsupported requests return a typed `unsupported` result before render; failed probes return `blocked` with a reason.
- Legacy tool adapters and versioned Presentation IR adapters share the same negotiation operation. Tests cover both contract types and the installed Slidev adapter; formats and feature requirements remain backend-specific.
- Slidev IR compilation now calls the shared Presentation IR semantic validator. The compiler keeps format-specific Markdown escaping and rendering checks, but no longer reimplements source IDs, duplicate IDs, chart structure, and verification-state validation.
- Slidev lineage sidecars now retain evidence and claim records. Evidence IDs can be referenced directly by slides and are preserved in notes and lineage with their verification state.

## Verification

Targeted protocol and Slidev IR tests cover supported requests, unsupported formats/features, probe failure, evidence-linked lineage, malformed chart data, and hostile Markdown. Full project checks are recorded in the phase commit summary.

## Limits and next slice

Negotiation is an explicit preflight operation exposed by adapters; generic orchestration does not yet choose or dispatch among multiple backends automatically. Slidev still exports no native chart objects, and complex SVG/DOM content may rasterize. Next, extend PptxGenJS IR mapping for rights-tracked assets and structured diagram/process elements with end-to-end fixtures and rendered-page inspection.
