# Isolated Mermaid diagram adapter

The optional Mermaid worker renders one `.mmd` source file to SVG, PNG, or PDF. It is pinned and isolated under `workers/mermaid`; the root application does not require Mermaid or Puppeteer to install or run. SVG remains a vector image in PPTX; neither SVG nor PNG is counted as native editable PowerPoint geometry. Keep the `.mmd` source for edits and lineage.

## Install and run locally

```powershell
npm run deps:mermaid
npm run diagram:mermaid -- --input examples/phase1/mermaid/synthetic-architecture.mmd --format svg
npm exec ai4slides -- tools doctor mermaid
npm exec ai4slides -- tools test mermaid
```

The example is hypothetical and contains no empirical data. Output and a `.diagram.json` manifest are written below `outputs/mermaid/` by default. The manifest includes source and artifact SHA-256 values, Mermaid version, format and editability notes.

## Isolation and limits

- The worker pins Mermaid CLI 12.2.0 and Puppeteer 25.0.2 in a separate lockfile. Its Chromium browser is managed by Puppeteer and is not checked into the repository.
- Render configuration uses Mermaid `securityLevel: strict`, a fixed theme, and a Puppeteer host resolver that rejects network hosts. Direct HTTP(S), `file://` and image/text data URI references in the DSL are rejected before launch.
- Input is bounded to 2 MiB and output paths must stay under the selected output directory. Existing outputs and the source are never overwritten.
- The CLI supports other features such as Markdown extraction, CSS and icon packs; this adapter intentionally does not expose those options. It accepts one `.mmd` file and does not claim to sanitize arbitrary third-party Mermaid extensions.
- Upstream Mermaid CLI declares MIT. The dependency tree and downloaded browser distribution still need a complete transitive license audit before redistribution.
