# Dependency and License Review

This is an initial inventory boundary, not legal advice or a complete software bill of materials. Candidate upstream tools are catalogued in `registry/catalog/*.yaml`; their licenses intentionally remain `needs-review` until the exact version and dependency closure are pinned and checked.

## Current root runtime

| Package | Lockfile version | Declared license / source | Use |
|---|---:|---|---|
| `pptxgenjs` | 4.0.1 | MIT (installed package metadata) | Native editable PPTX renderer |
| `fflate` | 0.8.3 | MIT (installed package metadata) | OOXML ZIP operations |
| `pdfjs-dist` | 5.4.624 | Apache-2.0 (installed package metadata) | Offline PDF text extraction fallback |

The project code is MIT (`LICENSE`). This does not grant rights to source documents, templates, fonts, images, generated outputs, SaaS content, or transitive dependencies. Do not copy/repackage third-party assets based only on a catalog link. Record asset-level attribution and permitted use. Python tools and large external services must be isolated and optional; they are not added to root npm dependencies by this tranche.

Before enabling an adapter, record exact upstream/version, SPDX identifier, license URL, transitive dependency inventory, platform, service terms/data retention (if hosted), and any redistribution restrictions. Re-audit when upgrading.
