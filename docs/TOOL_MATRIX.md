# Tool Matrix

The machine-readable catalog is in [`registry/catalog/`](../registry/catalog/). It currently contains 55 candidate entries. Every `.yaml` file is JSON syntax, which is valid YAML 1.2; the CLI uses Node's built-in JSON parser, so the base install gains no YAML dependency.

Each entry records official URL, kind, interface, platforms, capabilities, inputs/outputs, dependencies, network/auth/cost, editability, license review state, adapter state, and limitations. `version: not-pinned` means upstream version was not checked; `license.review_status: needs-review` is deliberately conservative and does not assert incompatibility.

## Status meanings

| Status | Meaning |
|---|---|
| `catalogued` | Candidate and intended role recorded. No executable adapter claim. |
| `adapter-ready` | Adapter code exists and can report requirements; output operation may still be incomplete. |
| `smoke-tested` | A real local probe completed for the stated version and capability. |
| `e2e-tested` | A fixture traversed the actual workflow and artifact QA passed. |
| `blocked` | Current execution cannot proceed; doctor reports the reason and a resolution. |

`ai4slides tools list` shows catalog status. `ai4slides tools doctor` probes implemented local requirements and reports unimplemented tools as blocked. `ai4slides tools test <id>` runs an adapter capability probe when one exists; catalog-only entries explicitly report that no smoke test is implemented. A tool's presence in this matrix is not proof of use.

## Current verified integration boundary

The original PptxGenJS tool adapter remains a dependency/smoke-test wrapper. The new `pptxgenjs-ir` adapter validates Presentation IR 1.0.0, maps the supported element subset through the existing renderer, emits editable PPTX plus lineage/run manifests, and runs structural QA before returning success. Its synthetic 3-slide route is registered and smoke-tested by the catalog CLI. The Slidev IR conversion/export remains a separate experimental route. Neither integration performs research or verifies evidence; external/cloud providers stay opt-in and are not contacted by `tools list`, `doctor`, or `test`.

Update each entry only when its executable, version, runtime, and test evidence are recorded. Use `npm run catalog:generate` to regenerate the catalog from its checked-in source.

## Phase-0 candidate evaluation snapshot (2026-11-12)

This table is execution evidence, distinct from the 52-entry discovery catalog. PptxGenJS, Slidev, PPTAgent, and Presenton have completed a generated-deck loop in this environment. The Presenton loop used a deterministic local mock rather than a model and failed visual promotion because titles truncate on 8/9 pages and cards clip on all 9. Slide-maker and SlidePoise remain source-inspected only. Details are in [`POC_RESULTS.md`](POC_RESULTS.md), [`BACKEND_BAKEOFF.md`](BACKEND_BAKEOFF.md), and [`PRESENTON_POC.md`](PRESENTON_POC.md); licenses are in [`LICENSE_AUDIT.md`](LICENSE_AUDIT.md).

| Candidate | Status in this environment | Input/output evidence | Native editability and integration conclusion |
|---|---|---|---|
| PptxGenJS | **locally rendered baseline** | Current 7-slide example generated, QA audited and all 7 rendered pages inspected. | 7/7 editable-text slides; 111 native shapes; 1 native chart and workbook; exact chart values. Keep as default research renderer. |
| Slidev | **experimental, e2e local synthetic POC** | 9-slide shared synthetic talk → PPTX/PDF/9 PNGs; pages inspected. | Editable text/shapes; tested Mermaid image is raster and no native chart object. Keep optional pending chart/lineage and page-edit evaluation. |
| Presenton | **API/export loop completed with deterministic stub; visual QA failed** | Authenticated API→layout→PPTX, 10 local mock calls, PDF and 9 PNGs; no model inference. | 9/9 text slides, 18 native text shapes, 45 pictures, 0 charts/tables, 9 notes; titles truncate on 8/9 pages and cards clip on 9/9. Keep optional/isolated with post-export QA. See `PRESENTON_POC.md`. |
| PPTAgent / DeepPresenter | **local Skill conversion completed; source-aware integration not yet connected** | Official Skill `pptagent==1.1.37`, commit `9dacac53ac9ef39346461063df729396551d929e`; synthetic HTML fixture → editable PPTX/PDF/9 page renders; `finalize complete=true`. | 9/9 text slides, 116 shapes, 17 lines, 2 tables, 0 pictures/charts. WSL is the tested runtime; arbitrary PPTX import/edit remains unverified. See `PPTAGENT_POC.md`. |
| slide-maker | **catalogued; runtime not tested** | Source inspected at `a9e2d326d59f720873aa0ee5c58003c4f876b0e0`; no Agent-host installation or model flow. | Editable output claims are upstream claims only; test in disposable Agent profile before adapter work. |
| SlidePoise | **catalogued; runtime not tested** | Source inspected at `40480fd4fcfeb23771386b72fc697bdee2d268b4`; no setup, image-generation or Agent workflow. | Reconstruction claims are upstream claims only; test with synthetic data and explicit image-generation permission. |

No candidate has been validated against all three requested audience/style groups. No empirical design ranking is available.

## Phase-1 IR adapter execution

`npm run render:ir -- --input examples/phase1/pptxgenjs-ir.json --out outputs/phase1/my-deck` generates a native PptxGenJS deck from the canonical IR. The adapter reports per-slide editability, output hashes, source lineage and a run manifest; it fails closed on unknown IDs and unsupported element kinds. The fixture intentionally produces an unverified-source warning. Tests and exact artifact QA are recorded in [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md).
