# Bake-off tests, licenses, and external dependencies

**Audit date:** 2026-11-12 · All versions below are observed in this checkout, lockfile, official package metadata, or upstream files. A mutable upstream `latest` tag is not a reproducible pin. Before distribution, regenerate a complete license/SBOM report from the exact dependency lockfiles and container digest.

## Tests and evidence

| Scope | Command/action | Result |
|---|---|---|
| Project dependency check | `npm run deps` | Pass: `pptxgenjs@4.0.1` MIT; `fflate@0.8.3` MIT; `pdfjs-dist@5.4.624` Apache-2.0. |
| Project automated suite | `npm run check` | Exit 0; 52/52 tests passed. It exercised deterministic import/build/QA flows and negative cases for evidence IDs, malformed charts/values, unsupported slide types and excessive text. It also exercised local tool-registry commands in the untracked working tree; those are not public-dev integration claims. |
| Project validation/build | `npm run validate`, `npm run build` (also included in successful `npm run check`) | Seven-slide project PPTX built. Warnings remain for missing chart sample size and E1/E2 `verified:false`; correctly not suppressed. |
| Slidev POC structure | `node src/qa.mjs outputs/open-source-bakeoff/slidev-systems-talk.pptx` | QA warning, not failure: 9 slides, 9 editable-text slides, 0 native charts. Open XML report: 59 text shapes, 13 additional shapes, 1 picture, 9 notes parts. |
| Slidev POC lineage | Local Open XML notes inspection | 9 notes parts; every note includes `S01`–`S09` and `E_SYN_01`. Sidecar `examples/open-source-bakeoff/slide-lineage.json` maps all nine slides. |
| Slidev POC visual | Export PDF + PNG and open all nine PNG pages | 9/9 pages reviewed. No clipping or overlaps observed; sparse default visual style, Mermaid diagram rasterized, no visible source footer. Full findings in [`BACKEND_BAKEOFF.md`](BACKEND_BAKEOFF.md). |
| PPTAgent setup | `pptagent.py --help`, `doctor`, `scaffold` | Help and 9-slide scaffold passed; doctor correctly blocked by missing PyMuPDF, Playwright, deeppresenter and LibreOffice. Full PPTX flow not run. |
| PPTAgent isolated requirements | `uv pip install --python .../.venv/Scripts/python.exe -r .../requirements.txt` | Blocked at `fasttext==0.9.3`: no compatible wheel in this environment and build requires Microsoft C++ Build Tools 14+. WSL launch separately returned `0x800705aa`. |
| Presenton runtime | `docker info`; `docker pull ghcr.io/presenton/presenton:v0.9.12-beta` | Both blocked before pulling or startup: Docker daemon pipe `npipe:////./pipe/docker_engine` missing. No service/API/PPTX run. |
| Git hygiene | `git diff --check` | Pass with Git line-ending normalization notices only. No tests were added or source-renderer changes made for the bake-off. |

## Direct dependency and license inventory

| Component | Version used / pinned | License observed | Local/remote dependency and risk |
|---|---|---|---|
| AIAutoSlides `pptxgenjs` | 4.0.1 (lockfile) | MIT | Local Node dependency; native PPTX output. |
| AIAutoSlides `fflate` | 0.8.3 (lockfile) | MIT | Local Node dependency; DOCX package extraction. |
| AIAutoSlides `pdfjs-dist` | 5.4.624 | Apache-2.0 | Local PDF text extraction; PDF.js is a parser, not OCR/scientific validation. |
| Slidev CLI | 53.1.0 | MIT | Isolated `outputs/m4/slidev-lab`; Node >=22.22; Vite and transitive npm packages. |
| Slidev default theme | 0.25.0 | MIT | Isolated npm dependency; its CSS/theme assets influence rendered slides. |
| Playwright Chromium | 1.65.0 | Apache-2.0 for npm package; browser binary has its own distribution notices | Exported using existing local Google Chrome; package does not imply browser executable bundled in this POC. Browser named `Arial` and `trebuchet ms`; PPTX fonts not embedded. |
| Presenton self-hosted image | Tag `v0.9.12-beta`; **digest not pulled/verified** | Apache-2.0 project | Docker Engine required. Local Ollama/provider possible; hosted LLM/image services require configured keys and may be paid. Fixed `slides_markdown` request is prepared; no generation done. |
| PPTAgent runtime | Git SHA `9dacac53ac9ef39346461063df729396551d929e`; Python package requirement `pptagent==1.1.37` | MIT project/Skill | Current requirements include `fasttext==0.9.3`, Playwright 1.62.0, PyYAML, Pillow, PyMuPDF, FastMCP and `deeppresenter`; runtime npm deps: `fast-glob`, `minimist`, Playwright 1.62.0, PptxGenJS and Sharp. Requires Linux/WSL or macOS plus LibreOffice. Some agent/vision review configurations can call external models; none were configured. |

## Candidate projects: license and external service boundaries

Official package/repository metadata checked for the integration matrix:

- **Presenton:** Apache-2.0; Docker, Electron or service. Local Ollama is supported; cloud AI/image provider is optional and can cost. Tag was researched, but no immutable digest was resolved in this run.
- **PPTAgent:** MIT; Linux/WSL/macOS-oriented Skill plus CLI. Static scaffold can run without an LLM. Visual review or coding-agent generation may invoke a configured external model; no key or content was sent.
- **Slidev:** MIT CLI/theme; local browser export; no AI API. Complex DOM elements (including Mermaid/SVG, canvas and other unsupported effects) can become embedded pictures. Exported text wrapping/fonts may differ in PowerPoint.
- **Frontend Slides:** MIT Skill. HTML is native output; PPTX editing/import fidelity is not established by this POC.
- **Quarto:** MIT CLI; Pandoc, engines, extensions and templates carry separate licenses. Local rendering has no required AI cost.
- **Marp:** MIT; browser required. Editable PPTX is explicitly experimental and additionally requires LibreOffice; notes are not preserved in that path.
- **Docling:** MIT code; selected ML model weights have separate licenses and local model-storage requirements.
- **MarkItDown:** MIT; optional format extras and integrations add dependencies; core local conversion does not require a paid API.
- **Mermaid:** MIT core. Diagram SVG/PNG export is not automatically an editable PowerPoint shape group.
- **ELK.js:** `EPL-2.0 OR GPL-3.0-or-later`; choose/review license obligations before redistribution. It computes layouts, not visuals.
- **draw.io:** core source Apache-2.0, but Desktop and Docker products are GPL-3.0; stencil/icon/template restrictions apply.
- **Vega-Lite:** BSD-3-Clause package; Vega and data assets have their own notices. Renderer output is SVG/canvas unless adapted to native PowerPoint charts.
- **python-pptx:** MIT, local Python; reads/writes PPTX, but round-tripping unsupported package parts needs explicit validation.
- **AIPPT:** Apache-2.0 project; generation and editable reconstruction use text/VLM/OCR/image providers and may incur charges; reconstruction does not make all objects semantically native.

Project-specific URLs, official APIs, OS compatibility notes, version snapshots, and integration recommendations are linked in [`OPEN_SOURCE_INTEGRATION_MATRIX.md`](OPEN_SOURCE_INTEGRATION_MATRIX.md). License review is not legal advice; include a transitive license/SBOM check in adapter CI before release.
