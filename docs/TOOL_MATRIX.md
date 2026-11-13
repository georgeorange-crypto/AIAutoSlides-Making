# Tool Matrix

The machine-readable catalog is in [`registry/catalog/`](../registry/catalog/). It currently contains 56 candidate entries. Every `.yaml` file is JSON syntax, which is valid YAML 1.2; the CLI uses Node's built-in JSON parser, so the base install gains no YAML dependency.

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

## P1/P2 continuation — 2026-11-12

| Tool | Current evidence | Boundary |
|---|---|---|
| Marp CLI 4.5.1 | Isolated lockfile, local adapter, `doctor` / `test`, and a real synthetic HTML+PPTX export; PowerPoint rendered both pages. | Default PPTX contains rendered page images (2 slides, 0 text runs in the test fixture). Do not claim native editability. Experimental editable export is not tested. |
| Presenton self-hosted v1 API | Loopback-only adapter and mocked contract tests; `doctor` reports missing credentials/service without contacting anything. | Adapter-ready only. No live service, model/provider invocation, deck export, cost, or editability has been verified. |
| Matplotlib 3.10.8 | Pinned isolated Python worker, source-ID check, line/bar/scatter/CDF mapping, SVG/PNG hashes, and a real synthetic PPTX+preview run. | The figure is an SVG picture, not a native PowerPoint chart. Source record remains unverified; transitive license closure is pending. |

Marp setup: `npm run deps:marp`; export the checked-in fixture with `npm run render:marp`. Presenton may run only when explicitly configured for a loopback instance and invoked with `allowProviderUsage: true`; no model call occurs during `tools doctor` or its mock contract test.

Matplotlib setup: `npm run deps:matplotlib`; export the synthetic fixture with `npm run render:matplotlib`. The worker uses the isolated Python environment under `workers/matplotlib/.venv/`.

Graphviz setup: Windows can run `npm run deps:graphviz` to download the official 16.1.1 x64 ZIP, verify its upstream SHA-256, and unpack it under the ignored `workers/graphviz/.tools/` directory. Render the synthetic fixture with `npm run render:graphviz`; output includes `.dot`, `.svg`, `.png`, and a provenance manifest. Inputs use a bounded JSON graph contract rather than arbitrary DOT so local file/image references cannot be smuggled in. SVG/PNG are not native PowerPoint shapes. Linux/macOS require Graphviz installed by the system package manager and `AI4SLIDES_GRAPHVIZ_DOT` set to its `dot` executable.

PyMuPDF setup: `npm run deps:pymupdf`; run the checked-in extraction fixture with `npm run import:pymupdf`. The worker uses `workers/pymupdf/.venv/`, emits page text/locators, bounded embedded-image files and vector drawing bounds, and does not run OCR. Its license state remains `needs-review`; resolve AGPL/commercial terms before redistribution. The fixture is synthetic and its extracted evidence remains unverified. Custom inputs can be passed as `npm run import:pymupdf -- --input <paper.pdf> --out <new-output-directory> --evidence-id E_LOCAL_PAPER --preview-pages 0,1`.

## Phase-0 candidate evaluation snapshot (2026-11-12)

This table is execution evidence, distinct from the 52-entry discovery catalog. Only PptxGenJS and Slidev completed a generated-deck loop in this environment. Presenton and PPTAgent were attempted but blocked; slide-maker and SlidePoise were inspected at pinned source SHAs but not installed or run end-to-end. Details and rerun requirements are in [`POC_RESULTS.md`](POC_RESULTS.md); license gates are in [`LICENSE_AUDIT.md`](LICENSE_AUDIT.md).

| Candidate | Status in this environment | Input/output evidence | Native editability and integration conclusion |
|---|---|---|---|
| PptxGenJS | **locally rendered baseline** | Current 7-slide example generated, QA audited and all 7 rendered pages inspected. | 7/7 editable-text slides; 111 native shapes; 1 native chart and workbook; exact chart values. Keep as default research renderer. |
| Slidev | **experimental, e2e local synthetic POC** | 9-slide shared synthetic talk → PPTX/PDF/9 PNGs; pages inspected. | Editable text/shapes; tested Mermaid image is raster and no native chart object. Keep optional pending chart/lineage and page-edit evaluation. |
| Presenton | **blocked** | Docker Engine unavailable before image pull/start; no generation request. | Output fidelity unknown. Retry with verified container and approved local provider. |
| PPTAgent / DeepPresenter | **partial setup / blocked** | Current Skill checkout and CLI help/doctor; Python dependency build and WSL failures prevented generation. | Output fidelity unknown. Repeat on supported Linux/WSL; keep historical paper tags separate. |
| slide-maker | **catalogued; runtime not tested** | Source inspected at `a9e2d326d59f720873aa0ee5c58003c4f876b0e0`; no Agent-host installation or model flow. | Editable output claims are upstream claims only; test in disposable Agent profile before adapter work. |
| SlidePoise | **catalogued; runtime not tested** | Source inspected at `40480fd4fcfeb23771386b72fc697bdee2d268b4`; no setup, image-generation or Agent workflow. | Reconstruction claims are upstream claims only; test with synthetic data and explicit image-generation permission. |

No candidate has been validated against all three requested audience/style groups. No empirical design ranking is available.

## Phase-1 IR adapter execution

`npm run render:ir -- --input examples/phase1/pptxgenjs-ir.json --out outputs/phase1/my-deck` generates a native PptxGenJS deck from the canonical IR. The adapter reports per-slide editability, output hashes, source lineage and a run manifest; it fails closed on unknown IDs and unsupported element kinds. The fixture intentionally produces an unverified-source warning. Tests and exact artifact QA are recorded in [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md).
