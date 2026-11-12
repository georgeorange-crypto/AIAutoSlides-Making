# Slidev backend adapter (phase 2)

This is the first runnable backend adapter behind the existing tool-adapter protocol. It is an isolated CLI integration: Slidev dependencies remain outside the project dependency tree and the PptxGenJS default build path is unchanged.

## Contract

`packages/adapters/slidev.mjs` exports `slidevAdapter` and `createSlidevAdapter`. It reports formats and limitations, checks the local CLI version, exports selected PPTX/PDF/PNG formats, hashes artifacts, copies an explicitly supplied source-lineage JSON sidecar, and verifies that notes in the PPTX preserve slide and evidence IDs. No API key or provider is needed for local rendering.

The Presentation IR mapper supports structured `bar`, `line`, `scatter`, and `cdf` charts. Slidev renders them as SVG visuals, while exact x/series values and evidence IDs remain in the lineage sidecar and source comment. These are not native PowerPoint chart objects and are not data-editable after export. PPTX output uses Slidev's `pptx-editable` format and disables click-step duplication. Basic text/shapes are editable; complex DOM/SVG may rasterize; existing-PPTX import is not supported. These limitations are returned as warnings and capability fields.

## Windows reproduction

Install Slidev into an isolated directory, then point the adapter at the installed JS entry and local Chrome:

```powershell
npm install --prefix outputs/m4/slidev-lab --no-save --ignore-scripts --no-audit --no-fund @slidev/cli@53.1.0 @slidev/theme-default@0.25.0
$env:SLIDEV_CLI = (Resolve-Path outputs/m4/slidev-lab/node_modules/@slidev/cli/bin/slidev.mjs).Path
$env:SLIDEV_CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
node scripts/run-slidev-backend.mjs --input examples/open-source-bakeoff/synthetic-systems-talk.md --out outputs/open-source-bakeoff/adapter --formats pptx-editable,pdf,png --lineage examples/open-source-bakeoff/slide-lineage.json
```

`SLIDEV_CLI` avoids relying on shell execution of a Windows `.cmd` shim. Linux/macOS can use `SLIDEV_BIN` or the `slidev` executable on `PATH`. Check the returned artifact paths and hashes; output directories are local build artifacts and are git-ignored.

## Committed synthetic run

The phase-2 run is retained under [`artifacts/open-source-bakeoff/slidev-adapter/`](../artifacts/open-source-bakeoff/slidev-adapter/): editable PPTX, PDF, all nine PNG pages, the object-level QA report, lineage sidecar, and backend manifest. It was produced by Slidev `53.1.0` on Node `v24.14.0` using local Chrome. AIAutoSlides QA reported 9 slides, 9 text-editable slides, and 0 native charts. The nine exported PNG pages were visually inspected; no clipping, overlap, missing page, or unreadable body text was observed. The Mermaid diagram remains an image object.

## Acceptance evidence

The adapter tests use an injected runner to verify format mapping, lineage preservation, output manifest creation, and invalid-input handling. Real export acceptance is separate: execute the command above, inspect PPTX object counts with `node src/qa.mjs <pptx>`, then visually inspect every exported PNG. A successful CLI exit alone is not a visual or scientific QA pass.
