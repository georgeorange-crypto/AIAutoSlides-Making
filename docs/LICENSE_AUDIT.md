# License and reuse audit — 2026-11-12

This is an integration gate, not legal advice. Repository license files cover only the corresponding repository code unless stated otherwise. Recheck exact revisions, transitive dependencies, model weights, fonts, templates, icon sets and media before distribution.

| Project | Observed repository license / source | Reuse posture | Outstanding checks |
|---|---|---|---|
| AIAutoSlides-Making | MIT (`LICENSE`) | Existing source may remain MIT. | Preserve notices for dependencies and any copied code/assets. |
| PptxGenJS | MIT; existing npm dependency, locked at 4.0.1 | Suitable for existing native PPTX renderer. | Audit npm dependency notices for bundled/released distribution. |
| Tesseract.js 7.0.0 | Apache-2.0; [npm package](https://www.npmjs.com/package/tesseract.js) | Bundled local OCR engine, invoked through its Node API. | Preserve third-party notices for distribution and audit transitive npm dependencies. |
| `@tesseract.js-data/eng` 1.0.0 and `@tesseract.js-data/chi_sim` 1.0.0 | MIT per package metadata; [English package](https://www.npmjs.com/package/@tesseract.js-data/eng), [Chinese package](https://www.npmjs.com/package/@tesseract.js-data/chi_sim) | Bundled traineddata for offline English and Simplified Chinese OCR. | Preserve notices; traineddata is a separate artifact with its own license from the OCR engine. |
| Slidev | MIT CLI and default theme (reported in local bake-off); exact tested versions 53.1.0 / 0.25.0; [upstream](https://github.com/slidevjs/slidev) | Isolated optional runtime; do not copy templates. | Audit transitive npm/browser packages and any user-selected themes/assets. |
| Presenton | Project reports Apache-2.0; [upstream](https://github.com/presenton/presenton) | Isolated service candidate only. | Verify exact container tag/digest, bundled fonts/assets, model/provider terms and all dependencies before redistribution. POC was blocked before pull. |
| PPTAgent / DeepPresenter | PPTAgent checkout reports MIT; [upstream](https://github.com/icip-cas/PPTAgent); current development line differs from paper reproduction tag. | Optional agent workflow; do not mix current Skill and paper-tag claims. | Audit DeepPresenter subproject and model/API terms, Python/npm dependencies, fonts and any downloaded assets. No generated artifact in this POC. |
| slide-maker | MIT license observed at SHA `a9e2d326d59f720873aa0ee5c58003c4f876b0e0`; [upstream](https://github.com/addsumtech/slides_maker) | Skill code can be evaluated separately; do not bundle without notice review. | Audit Python dependencies, templates, assets and any external model/search services. Runtime not installed or exercised. |
| SlidePoise | MIT license observed at SHA `40480fd4fcfeb23771386b72fc697bdee2d268b4`; [upstream](https://github.com/henryhyw/slidepoise) | Skill/runtime candidate only; no code copied into this project. | Audit npm/Python dependencies, icon libraries, Wikimedia assets, image-generation model and setup downloads. Runtime not installed or exercised. |
| MinerU | Blueprint flags custom/additional conditions | **Do not integrate or redistribute** until full license and model terms are reviewed for this use. | Legal/commercial use, model weights and service terms. |
| Firecrawl | AGPL-3.0 (per blueprint) | Keep as optional independent service/API; no copied code in MIT core. | Network-use obligations, hosted service terms, modifications and deployment model. |
| Fonts, templates, icons, media and image models | Not covered by the engine's top-level license | Do not infer reuse rights from public availability or project license. | Record each asset's author/source/license/attribution and model/provider terms; honor API hotlink/download and usage conditions. |

## Release gate

Before promoting any candidate to an integrated or bundled backend: pin source commit and artifacts by digest; generate an SPDX/CycloneDX or equivalent dependency inventory; review notices and license compatibility; record model and media rights; document network-service obligations; and keep provenance attached to generated output. `needs-review` is a hold state, not a finding that a project is incompatible.
