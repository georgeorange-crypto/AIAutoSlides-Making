# Dependency and License Review

This is an initial inventory boundary, not legal advice or a complete software bill of materials. Candidate upstream tools are catalogued in `registry/catalog/*.yaml`; their licenses intentionally remain `needs-review` until the exact version and dependency closure are pinned and checked.

## Current root runtime

| Package | Lockfile version | Declared license / source | Use |
|---|---:|---|---|
| `pptxgenjs` | 4.0.1 | MIT (installed package metadata) | Native editable PPTX renderer |
| `fflate` | 0.8.3 | MIT (installed package metadata) | OOXML ZIP operations |
| `pdfjs-dist` | 5.4.624 | Apache-2.0 (installed package metadata) | Offline PDF text extraction fallback |
| `@marp-team/marp-cli` (isolated `workers/marp/`) | 4.5.1 | MIT (npm package metadata) | Optional Markdown→HTML/PDF/image-backed PPTX renderer |
| `matplotlib` (isolated `workers/matplotlib/`) | 3.10.8 | Matplotlib License 1.3.0+ (PSF-based, BSD-compatible) | Deterministic local scientific figures; dependency versions pinned in `requirements.lock.txt` |
| `pymupdf` (isolated `workers/pymupdf/`) | 2.1 | GNU AGPL-3.0 or Artifex commercial license ([official license terms](https://pymupdf.readthedocs.io/en/latest/about.html#license-and-copyright), [PyPI metadata](https://pypi.org/project/PyMuPDF/2.1/)) | Local PDF text, image, vector metadata and selected-page previews; licensing path must be resolved before redistribution |
| Graphviz (isolated official Windows ZIP under ignored `workers/graphviz/.tools/`) | 16.1.1 | EPL-2.0 ([official license page](https://graphviz.org/license/)) | Local DOT rendering; the optional binary ZIP's bundled libraries/notices are not redistributed by this repository |
| D2 (isolated official Windows x64 archive under ignored `workers/d2/.tools/`) | 0.9.0 | MIT ([official source repository](https://github.com/terrastruct/d2)) | Local D2 DSL rendering; the optional binary archive and bundled runtime are not redistributed by this repository |
| Quarto (isolated official Windows ZIP under ignored `workers/quarto/.tools/`) | 1.11.9 | MIT ([official source repository](https://github.com/quarto-dev/quarto-cli)) | Local reveal.js and PPTX rendering; the optional binary archive and bundled runtimes are not redistributed by this repository |
| LibreOffice (locally installed, not bundled) | 26.2.3.2 verified on this Windows machine | MPL-2.0 and additional component-specific terms; needs-review | Headless Impress rendering through existing `scripts/preview.mjs`; complete bundled-runtime license closure is not audited |

The project code is MIT (`LICENSE`). This does not grant rights to source documents, templates, fonts, images, generated outputs, SaaS content, or transitive dependencies. Do not copy/repackage third-party assets based only on a catalog link. Record asset-level attribution and permitted use. Python tools and large external services must be isolated and optional; they are not added to root npm dependencies by this tranche.

Before enabling an adapter, record exact upstream/version, SPDX identifier, license URL, transitive dependency inventory, platform, service terms/data retention (if hosted), and any redistribution restrictions. Marp's transitive npm closure and Matplotlib's pinned Python dependencies/bundled-font licenses have not yet had a full closure review. PyMuPDF 2.1 is dual licensed under AGPL and Artifex commercial terms; this repository has not selected or approved a distribution path, so its adapter remains optional and license review remains pending. Matplotlib upstream describes its own license as PSF-based and BSD-compatible. Re-audit when upgrading.
