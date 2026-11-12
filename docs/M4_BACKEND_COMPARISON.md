# M4 open-source backend comparison

**Decision:** Keep the project's native PptxGenJS exporter as the default. Record Slidev `pptx-editable` as a viable, optional interoperability path, but do not integrate it into the generation pipeline yet.

## What was tested

- Controlled input: [`examples/m4/backend-comparison.json`](../examples/m4/backend-comparison.json), [`backend-comparison-evidence.json`](../examples/m4/backend-comparison-evidence.json), and [`backend-comparison.md`](../examples/m4/backend-comparison.md). The content is synthetic QA copy, not research data. Its `E_SYN_M4` ledger entry is intentionally `verified:false`.
- Native output: `node src/cli.mjs build --input examples/m4/backend-comparison.json --evidence examples/m4/backend-comparison-evidence.json --out outputs/m4/native.pptx`.
- Open-source output: Slidev CLI 53.1.0, `@slidev/theme-default`, Playwright Chromium 1.65.0 using the already installed Google Chrome executable. All packages were installed temporarily under ignored `outputs/m4/slidev-lab`; project dependencies and lockfile were not changed. Slidev CLI and its default theme declare MIT licenses.
- Export command: `slidev export examples/m4/backend-comparison.md --format pptx-editable --output outputs/m4/slidev-editable.pptx --with-clicks false --executable-path "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"`.
- Both outputs were inspected by `src/qa.mjs`, rendered using `scripts/preview.mjs`, and all six PNG pages were opened and reviewed. Temporary PPTX/PDF/PNG files are under ignored `outputs/m4/` and are not in the Git commit.

## Observed results

| Measure | Native project exporter | Slidev editable exporter |
|---|---:|---:|
| Slides / 16:9 | 3 / yes | 3 / yes (aspect ratio 1.7786) |
| Slides with editable text | 3/3 | 3/3 |
| Raster image objects | 0 | 0 |
| Native chart objects | 0 (fixture has no chart) | 0 (fixture has no chart) |
| Text object runs, slides 1–3 | 8 / 9 / 6 | 3 / 5 / 3 |
| Text-shape bounds | Pass on all 3 | Pass on all 3 |
| Rendered pages visually reviewed | 3/3 | 3/3 |

Both exports preserve selectable text in this text-only fixture. The native project deck has its Keynote theme, footer/source labeling, card treatments, and larger hierarchy; the Slidev deck is readable and unclipped in this render but drops much of that styling into a sparse text layout. This is a small controlled compatibility check, not a broad visual-fidelity or performance benchmark. PptxGenJS QA reports a warning because the synthetic evidence is unverified; the Slidev QA report also warns that its direct exporter does not emit the project's review/source input metadata.

## Why Slidev is not integrated as a default adapter

Slidev's official documentation describes `pptx-editable` as rebuilding browser elements into PowerPoint shapes, while some SVG/canvas/iframe/video/KaTeX/gradient/filter content may remain images or trigger per-slide image fallback; text wrapping may differ between browser and PowerPoint. The test confirmed editable text and zero raster pictures for this narrow fixture, but does not test those complex cases. Its exporter currently bypasses this project's validated storyboard/evidence lineage, native-chart mapping, and QA report contract. Integrating it as a supported backend needs explicit evidence-manifest and chart-parity tests before it can meet the product contract.

Slidev's standard `pptx` export is image-based, so the comparison intentionally used `pptx-editable`. Marp also documents editable PPTX as experimental and dependent on browser/LibreOffice; Quarto documents a Pandoc-based PowerPoint route with editable text and slide themes. These remain candidates for future, separate capability checks rather than assumed equivalents.

Sources: [Slidev exporting guide](https://sli.dev/guide/exporting.html), [Slidev CLI](https://sli.dev/builtin/cli), [Marp CLI](https://github.com/marp-team/marp-cli/blob/main/README.md), and [Quarto PowerPoint guide](https://quarto.org/docs/presentations/powerpoint.html). These descriptions informed candidate selection; measured results above come only from the local synthetic fixture.

## Reproduction

From the repository root on a machine with Node.js 22.22+ and Chrome installed:

```powershell
npm install --prefix outputs/m4/slidev-lab --no-save --ignore-scripts --no-audit --no-fund @slidev/cli@53.1.0 playwright-chromium@1.65.0 @slidev/theme-default
node src/cli.mjs build --input examples/m4/backend-comparison.json --evidence examples/m4/backend-comparison-evidence.json --out outputs/m4/native.pptx
& .\outputs\m4\slidev-lab\node_modules\.bin\slidev.cmd export examples/m4/backend-comparison.md --format pptx-editable --output outputs/m4/slidev-editable.pptx --with-clicks false --executable-path 'C:\Program Files\Google\Chrome\Application\chrome.exe'
node src/qa.mjs outputs/m4/native.pptx
node src/qa.mjs outputs/m4/slidev-editable.pptx
node scripts/preview.mjs outputs/m4/native.pptx
node scripts/preview.mjs outputs/m4/slidev-editable.pptx
```

The local QA intentionally treats neither the unverified synthetic fixture nor Slidev's exporter report as evidence of scientific verification. Do not use the fixture for product-performance claims.
