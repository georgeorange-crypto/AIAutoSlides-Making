# M4 open-source backend comparison

**Decision:** Keep the project's native PptxGenJS exporter as the default. Slidev `pptx-editable` is an optional interoperability backend; its Presentation IR mapper now includes deterministic SVG charts and a source-lineage data sidecar. It does not provide native chart objects or a complete round-trip chart edit path.

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

Slidev's official documentation describes `pptx-editable` as rebuilding browser elements into PowerPoint shapes, while some SVG/canvas/iframe/video/KaTeX/gradient/filter content may remain images or trigger per-slide image fallback; text wrapping may differ between browser and PowerPoint. The IR mapper retains exact chart values and evidence IDs in a sidecar and emits an SVG visualization, but the export is still not a native PowerPoint chart. Tests reject malformed/misaligned series and verify value/lineage parity at the mapper boundary. This does not establish round-trip data editability or parity for arbitrary custom Markdown.

Slidev's standard `pptx` export is image-based, so the comparison intentionally used `pptx-editable`. Marp also documents editable PPTX as experimental and dependent on browser/LibreOffice; Quarto documents a Pandoc-based PowerPoint route with editable text and slide themes. These remain candidates for future, separate capability checks rather than assumed equivalents.

## Structured chart and source-lineage follow-up

- Added [`slidev-chart-parity-ir.json`](../examples/m4/slidev-chart-parity-ir.json), a one-slide synthetic fixture with two four-value line series and source `E_SYN_CHART` (`unverified`). The Presentation IR mapper emits SVG and records exact x/y values plus source IDs in `slide-lineage.json`.
- A real local Slidev 53.1.0 `pptx-editable` export produced [`presentation.pptx`](../outputs/m4/slidev-chart-parity/accepted/presentation.pptx) and [`lineage-validation.json`](../outputs/m4/slidev-chart-parity/accepted/lineage-validation.json). Note validation passed for S01/E_SYN_CHART. Structural QA reported 1/1 editable-text slide and 0 native chart objects, as expected; the plotted SVG is a visual object, not a PowerPoint data chart.
- A local PDF export and page raster were visually inspected at [`page-1.png`](../outputs/m4/slidev-chart-parity/retry/page-1.png). The synthetic two-series line plot, numeric ticks, titles and source note are visible; the y-axis label was moved to the upper-right chart edge after the first render exposed tick-label overlap. This is a single synthetic renderer check, not a general guarantee for long axis labels or other chart types.
- Exporting the PPTX and PDF in one invocation once timed out waiting for the browser body. Separate PPTX and PDF exports succeeded. PNG export produced an empty folder in this environment; the PDF was rasterized with local Poppler instead. This is recorded as an adapter/Slidev rendering caveat.

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
