# Mermaid local diagram and PPTX integration POC

## Result

**Local generation and PPTX embedding passed; full-deck visual acceptance is pending.** The isolated Mermaid worker was installed on Windows and generated the repository's synthetic architecture fixture to SVG and PNG. The PNG was opened and visually checked: four expected nodes appear in order with connecting arrows, without clipping or unexpected labels. The generated diagram was embedded into the existing nine-slide synthetic Presentation IR deck through its local asset manifest and PptxGenJS adapter.

This validates Mermaid as a local diagram-authoring helper, not as a complete slide backend. In the output PPTX, Mermaid contributes one SVG picture object; its node text and geometry are not PowerPoint shapes. Surrounding IR text and other PptxGenJS objects remain separate editable objects. A human can edit the `.mmd` and regenerate the asset, but cannot select Mermaid nodes in PowerPoint.

## Reproduction

From the repository root on Windows, with Node 22.13+ and network access available for the one-time isolated install:

```powershell
npm run deps:mermaid
npm exec ai4slides -- tools doctor mermaid
npm exec ai4slides -- tools test mermaid
node scripts/render-mermaid.mjs --input examples/phase1/mermaid/synthetic-architecture.mmd --format svg --out-dir outputs/open-source-bakeoff/mermaid-lab-20261112
node scripts/render-mermaid.mjs --input examples/phase1/mermaid/synthetic-architecture.mmd --format png --out-dir outputs/open-source-bakeoff/mermaid-lab-20261112
node scripts/run-mermaid-pptx-poc.mjs outputs/open-source-bakeoff/mermaid-pptx-poc-20261112-rerun
```

The POC refuses to overwrite an existing output directory. It writes a copied SVG, the adapted IR, the PPTX and sidecars, plus `poc-report.json`. `outputs/` is ignored by Git; generated decks/previews are retained locally for inspection and are not committed.

## Evidence recorded in this run

- Installed isolated package versions: `@mermaid-js/mermaid-cli@12.2.0`, `puppeteer@25.0.2`; worker Chromium was installed by Puppeteer. `tools doctor mermaid` returned available at 12.2.0, and `tools test mermaid` rendered and checked four expected SVG node IDs.
- No model, cloud API, paid service or external source document was used. The input is `examples/phase1/mermaid/synthetic-architecture.mmd` (156 bytes), a hypothetical client → API gateway → scheduler → inference worker flow.
- Mermaid SVG SHA-256: `7b0476ca152f8911db6acff27d35d25fd406e923ba4f26573ce67a4a7912e154` (13,396 bytes). PNG SHA-256: `62cd3bc3e653a43a217d08eee91698764e4b16b91b51cbbc3d239265bbdc14a7` (5,619 bytes).
- Integrated PPTX SHA-256: `1ae5d7ae3717e37158d0f03c8e4154705149d614f725563caadb1ac87a5ec792`. It contains nine slides. Slide S03 has editable text, nine native shapes from the surrounding PptxGenJS rendering and one picture object for the Mermaid SVG; zero native chart/table objects on that slide. The adapter's structural QA status is `warning`, with explicit unverified synthetic evidence, pending asset rights, and picture-object warnings; no structural errors were returned.
- Diagram PNG visual inspection passed. Full-deck visual inspection was not completed: neither LibreOffice/soffice nor PowerPoint CLI is available on this host. Do not treat structural QA as visual acceptance.
- An initial harness attempt retained S03's `architecture` slide type after replacing its required structured diagram element with an image; the existing PptxGenJS adapter correctly rejected that invalid combination. The reproducible harness now maps this mixed content to `statement`, retaining evidence IDs and slide placement. This is an adapter-contract constraint, not a Mermaid rendering failure.

## Integration and licensing boundary

Keep Mermaid as a separately installed optional CLI worker. The existing `mermaidAdapter` owns bounded DSL validation, local-only browser configuration, output hashing and a diagram manifest. A caller can put the resulting local SVG into the existing Presentation IR asset manifest, preserving source ID, SHA-256, media type, license/review status and slide placement; the existing PptxGenJS adapter then embeds it and emits lineage/QA sidecars. There is no need to add Mermaid to the root application dependencies or rewrite the renderer.

The tested `@mermaid-js/mermaid-cli` package declares MIT. Mermaid's 12.3.0 release notes identify its bundled ELK.js dependency as `EPL-2.0 OR GPL-3.0-or-later`. The isolated lockfile resolves packages through `registry.npmmirror.com`; record this registry source and review the full JavaScript dependency and Puppeteer-managed browser license inventory before redistributing a bundle. The generated fixture SVG has pending rights metadata in the test deck; embedding does not grant reuse rights. Mermaid CLI and worker source version differ (12.2.0 worker vs. upstream 12.3.0 stable at the research snapshot), so upgrade only by changing the isolated pin after rerunning the POC.

## Limitations

- The PPTX keeps the diagram as a single SVG picture object, not individually editable nodes/connectors. Requiring native PowerPoint geometry should use the existing structured diagram element or the ELK.js-to-native-shapes path.
- This fixture does not exercise PDF/PNG export from the integrated PPTX. Mermaid's standalone PNG is visually checked, but a slide preview renderer is still required for full-deck visual acceptance.
- POC covers one `.mmd` file, neutral theme, local URLs rejected, and one synthetic flowchart. It does not qualify arbitrary Mermaid syntax, custom CSS, icon packs, large diagrams or real research figures.
- This proves rendering/embedding only. It does not change Mermaid's status as a diagram tool into a scientific source of truth or evidence verifier.
