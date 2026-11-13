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

The original PptxGenJS tool adapter remains a dependency/smoke-test wrapper. The new `pptxgenjs-ir` adapter validates Presentation IR 1.0.0, maps the supported element subset through the existing renderer, emits editable PPTX plus lineage/run manifests, and runs structural QA before returning success. Its synthetic 3-slide route is registered and smoke-tested by the catalog CLI. It also converts a documented bounded acyclic Mermaid flowchart subset into native editable shapes; unsupported input remains editable source text with a warning. The Slidev IR conversion/export remains a separate experimental route and may rasterize Mermaid. Neither integration performs research or verifies evidence; external/cloud providers stay opt-in and are not contacted by `tools list`, `doctor`, or `test`.

Update each entry only when its executable, version, runtime, and test evidence are recorded. Use `npm run catalog:generate` to regenerate the catalog from its checked-in source.

## P1/P2 continuation — 2026-11-12

| Tool | Current evidence | Boundary |
|---|---|---|
| Marp CLI 4.5.1 | Isolated lockfile, local adapter, `doctor` / `test`, and a real synthetic HTML+PPTX export; PowerPoint rendered both pages. | Default PPTX contains rendered page images (2 slides, 0 text runs in the test fixture). Do not claim native editability. Experimental editable export is not tested. |
| Presenton self-hosted v1 API | Loopback-only adapter and mocked contract tests; `doctor` reports missing credentials/service without contacting anything. Local service boot and Ollama-backed model setup are separately verified in `INTEGRATION_STATUS.md`. | Real generation/export and resulting deck editability still require an authenticated local instance and a successful synthetic generation run. No cloud model/provider call is allowed by the default route. |
| Matplotlib 3.10.8 | Pinned isolated Python worker, source-ID check, line/bar/scatter/CDF mapping, SVG/PNG hashes, and a real synthetic PPTX+preview run. | The figure is an SVG picture, not a native PowerPoint chart. Source record remains unverified; transitive license closure is pending. |

Marp setup: `npm run deps:marp`; export the checked-in fixture with `npm run render:marp`. For a local Presenton model, run `npm run deps:presenton-model`; this downloads a pinned Qwen2.5 1.5B GGUF to the ignored `workers/presenton/.models/`, verifies its exact size and SHA-256, imports it into local Ollama, and performs a loopback-only completion smoke. Configure self-hosted Presenton with `LLM=ollama`, `OLLAMA_MODEL=ai4slides-qwen2.5-1.5b-instruct`, `OLLAMA_URL=http://host.docker.internal:11434`, and `DISABLE_IMAGE_GENERATION=true`. The adapter may run only against a loopback Presenton instance and with `allowProviderUsage: true`; `tools doctor` and the mocked contract test make no provider calls.

Matplotlib setup: `npm run deps:matplotlib`; export the synthetic fixture with `npm run render:matplotlib`. The worker uses the isolated Python environment under `workers/matplotlib/.venv/`.

Graphviz setup: Windows can run `npm run deps:graphviz` to download the official 16.1.1 x64 ZIP, verify its upstream SHA-256, and unpack it under the ignored `workers/graphviz/.tools/` directory. Render the synthetic fixture with `npm run render:graphviz`; output includes `.dot`, `.svg`, `.png`, and a provenance manifest. Inputs use a bounded JSON graph contract rather than arbitrary DOT so local file/image references cannot be smuggled in. SVG/PNG are not native PowerPoint shapes. Linux/macOS require Graphviz installed by the system package manager and `AI4SLIDES_GRAPHVIZ_DOT` set to its `dot` executable.

D2 setup: Windows can run `npm run deps:d2` to download the official v0.9.0 x64 release archive, verify the published SHA-256, and unpack it under the ignored `workers/d2/.tools/` directory. Render the synthetic fixture with `npm run render:d2`; output includes the `.d2` source, `.svg`, `.png`, and a provenance manifest. The adapter rejects imports and external URL/image directives and requires ledger source IDs. SVG/PNG are not native PowerPoint shapes. Linux/macOS require D2 installed according to the official instructions and `AI4SLIDES_D2_BIN` set to its executable.

Quarto setup: Windows can run `npm run deps:quarto` to download the official 1.11.9 ZIP, verify its published SHA-256, and unpack it under ignored `workers/quarto/.tools/`. `npm run render:quarto` renders the bounded synthetic JSON slide spec to standalone reveal.js HTML and editable-text PPTX, retaining source IDs on every slide and writing an artifact manifest. The adapter accepts plain text only, does not run code or extensions, and rejects HTML and external references. On other platforms install Quarto using its official instructions and set `AI4SLIDES_QUARTO_BIN`.

LibreOffice preview: install LibreOffice Impress and Poppler (`pdftoppm`), then set `AI4SLIDES_LIBREOFFICE_BIN` if `soffice` is not on PATH. Run `npm run preview:libreoffice -- <deck.pptx>` for direct page previews, or use `ai4slides tools test libreoffice` for a disposable real two-slide render. The adapter copies a local PPTX into a new output directory, emits PDF/PNG pages and SHA-256 manifest, and refuses to overwrite. PowerPoint and LibreOffice fidelity differ; inspect every page.

PyMuPDF setup: `npm run deps:pymupdf`; run the checked-in extraction fixture with `npm run import:pymupdf`. The worker uses `workers/pymupdf/.venv/`, emits page text/locators, bounded embedded-image files and vector drawing bounds, and does not run OCR. Its license state remains `needs-review`; resolve AGPL/commercial terms before redistribution. The fixture is synthetic and its extracted evidence remains unverified. Custom inputs can be passed as `npm run import:pymupdf -- --input <paper.pdf> --out <new-output-directory> --evidence-id E_LOCAL_PAPER --preview-pages 0,1`.

## Phase-0 candidate evaluation snapshot (2026-11-12)

This table is execution evidence, distinct from the 56-entry discovery catalog. PptxGenJS, Slidev and deterministic PPTAgent conversion completed generated-deck loops. Presenton service/API smoke passed but it could not generate without its configured local model; slide-maker and SlidePoise remain unrun end-to-end. Details and rerun requirements are in [`POC_RESULTS.md`](POC_RESULTS.md); license gates are in [`LICENSE_AUDIT.md`](LICENSE_AUDIT.md).

| Candidate | Status in this environment | Input/output evidence | Native editability and integration conclusion |
|---|---|---|---|
| PptxGenJS | **locally rendered baseline** | Current 7-slide example generated, QA audited and all 7 rendered pages inspected. | 7/7 editable-text slides; 111 native shapes; 1 native chart and workbook; exact chart values. Keep as default research renderer. |
| Slidev | **experimental, e2e local synthetic POC** | 9-slide shared synthetic talk → PPTX/PDF/9 PNGs; pages inspected. | Editable text/shapes; tested Mermaid image is raster and no native chart object. Keep optional pending chart/lineage and page-edit evaluation. |
| Presenton | **service smoke; generation blocked** | Local v0.9.12-beta image, digest and API HTTP 200 recorded; configured Ollama model missing (HTTP 404); no deck. | Output fidelity unknown. Requires an already available, approved local model; no model was downloaded. |
| PPTAgent standalone Skill | **deterministic conversion e2e** | Nine-slide HTML fixture converted to PPTX/PDF/PNGs; final PPTX hash and all nine reviewed pages checked in. | 9/9 editable-text slides, 116 shapes, 17 connectors, 2 tables, no images/charts. No AI authoring or edit-one-slide fidelity claim. |
| slide-maker | **catalogued; runtime not tested** | Source inspected at `a9e2d326d59f720873aa0ee5c58003c4f876b0e0`; no Agent-host installation or model flow. | Editable output claims are upstream claims only; test in disposable Agent profile before adapter work. |
| SlidePoise | **catalogued; runtime not tested** | Source inspected at `40480fd4fcfeb23771386b72fc697bdee2d268b4`; no setup, image-generation or Agent workflow. | Reconstruction claims are upstream claims only; test with synthetic data and explicit image-generation permission. |

No candidate has been validated against all three requested audience/style groups. No empirical design ranking is available.

PptxGenJS, Slidev and PPTAgent conversion completed generated-deck loops. This remains a bounded POC rather than a matched three-task bakeoff: Presenton did not generate a deck; slide-maker and SlidePoise were not run end-to-end.

## Phase-1 IR adapter execution

`npm run render:ir -- --input examples/phase1/pptxgenjs-ir.json --out outputs/phase1/my-deck` generates a native PptxGenJS deck from the canonical IR. The adapter reports per-slide editability, output hashes, source lineage and a run manifest; it fails closed on unknown IDs and unsupported element kinds. The fixture intentionally produces an unverified-source warning. Tests and exact artifact QA are recorded in [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md).
