# ELK.js editable architecture layout POC

**Status:** synthetic local layout, PPTX generation and object QA passed on 2026-11-12. Visual QA is partial: a preliminary render exposed group-boundary collisions, which were corrected in the PPTX geometry; the host's PowerPoint COM process then stopped responding, so the final geometry has not yet been rerendered for visual confirmation. This is a diagram-layout adapter experiment, not a full presentation backend promotion.

## Reproduce

Prerequisites: Node.js `v24.14.0`, npm `11.9.0`, Windows, and the repository's normal dependencies from `npm ci`. ELK.js stays outside the project dependency manifest and lockfile:

```powershell
npm ci
npm install --prefix outputs/open-source-bakeoff/elkjs-lab --no-save --no-audit --no-fund elkjs@0.12.1
node scripts/layout-architecture-elk.mjs
node src/cli.mjs validate --input outputs/open-source-bakeoff/elkjs/storyboard.json --evidence examples/open-source-bakeoff/elkjs/evidence.json
node src/cli.mjs build --input outputs/open-source-bakeoff/elkjs/storyboard.json --evidence examples/open-source-bakeoff/elkjs/evidence.json --out outputs/open-source-bakeoff/elkjs/elkjs-editable.pptx
node src/qa.mjs outputs/open-source-bakeoff/elkjs/elkjs-editable.pptx
node scripts/preview.mjs outputs/open-source-bakeoff/elkjs/elkjs-editable.pptx
```

An initial preview produced a PDF/PNG, and the PNG was inspected. It showed the manually specified plane boxes crossing node boundaries, so the adapter was changed to assign wider request/control/execution zones and the PPTX was rebuilt. Subsequent attempts to export that updated file through PowerPoint COM did not return on this host; LibreOffice is not installed. The initial PDF/PNG therefore predate the final group-zone correction and are not valid visual proof for the current PPTX. On a responsive renderer, run the preview command above; its direct Poppler rasterization command is:

```powershell
pdftoppm -f 1 -l 1 -png -r 120 outputs/open-source-bakeoff/elkjs/elkjs-editable.pdf outputs/open-source-bakeoff/elkjs/elkjs-editable-page
```

The second command above is rerunnable independently. PNG rendering used Poppler `pdftoppm 26.07.0`; output was opened and visually reviewed. The preview script therefore remains a known integration issue for this Windows host even though the PPTX→PDF and PDF→PNG steps each produced valid outputs.

## Pin and environment evidence

- npm package: [`elkjs@0.12.1`](https://www.npmjs.com/package/elkjs/v/0.12.1), package metadata reports license `EPL-2.0 OR GPL-3.0-or-later`, `gitHead` `624ae90aa37110033a8af59c5ccbb292708b4317`. Runtime dependencies from the package metadata: none.
- Upstream repository snapshot checked: [`42a52f152a233f84906e5f4516608f657d7b236e`](https://github.com/kieler/elkjs/commit/42a52f152a233f84906e5f4516608f657d7b236e). The npm package `gitHead` differs from the later repository snapshot, so the tested npm tarball pin is authoritative for this POC.
- Install output: `added 1 package`; no project manifest or lockfile changed.
- Input: [`architecture.json`](../examples/open-source-bakeoff/elkjs/architecture.json), explicitly marked `SYNTHETIC / HYPOTHETICAL`; 5 nodes and 4 directed edges.
- Layout call: `elk.algorithm=layered`, `elk.direction=RIGHT`; ELK graph bounds `922 × 186`; scaled to slide area `{x:1.02,y:3.05,w:11.25,h:2.65}`. Node IDs, labels, edge IDs/labels and evidence ledger are carried through unchanged.
- No model/API, cloud service, remote content, or paid account was used. Input guard rejects fixtures whose status is not exactly `SYNTHETIC / HYPOTHETICAL`.

## Output and object-level editability

Artifacts remain local under the git-ignored `outputs/open-source-bakeoff/elkjs/` directory; generated decks and preview images are intentionally not committed.

| Artifact | SHA-256 |
|---|---|
| `elkjs-editable.pptx` | `b2f4b76e9a5d933b657d13ef379fddcddcbe541606a8b527a40bb3a1903bed14` |

`src/qa.mjs` reported a 16:9 one-slide deck, 14 editable text runs, 28 native PowerPoint shapes, 6 native line-shape objects, 0 picture objects, valid bounds, 0 text-overlap pairs, and minimum theme contrast 4.64:1. The source graph's 5 node IDs and 4 edge records match the generated layout and lineage. The six line-shapes include the four diagram connectors plus decorative renderer lines. The POC does not claim a native chart.

### Visual review (all output pages)

The preliminary page showed all five node labels readable, edges clear of labels, and title/footer in bounds. It also showed nodes straddling the three plane boundaries. The final layout adapter now sets request/control/execution panels to x/w `{0.85,3.0}`, `{3.95,5.5}`, `{9.55,2.95}`; final node positions are unchanged and fall within those regions by coordinate inspection. Because the updated deck could not be rerendered, visual acceptance remains **pending**. The group zones are visual containers whose geometry is currently mapped by the adapter rather than inferred by ELK.

The warning in the machine QA report for the unverified evidence ID is expected: the fixture describes no real system and is explicitly synthetic. This is not evidence about an actual inference service.

## Boundaries and integration decision

ELK.js is only a layout engine. The POC compiles `{nodes,edges}` to ELK JSON, computes layered positions, scales node coordinates into the existing architecture-diagram bounds, and passes the graph back to the AIAutoSlides renderer. The existing renderer creates the editable PowerPoint text boxes, shapes and connectors. Do not put ELK.js in the main dependency tree until a license choice and distribution review are complete.

Supported in this slice: flat directed graphs, 2–12 nodes under the current storyboard validator, node positions, existing edge labels, and native editable rendering. Not yet supported: nested/compound ELK graphs, routed edge bend points and ports (renderer draws straight center-to-center connectors), edge labels sized during layout, automatic group inference, incremental layout stability, arbitrary diagram types, or existing-PPTX diagram editing. For final integration expose an optional `DiagramLayoutBackend` with `capabilities()`, `layout(graph, options)`, pinned runtime metadata, deterministic coordinates, and a sidecar report; keep evidence validation and rendering in AIAutoSlides. Required before promotion: license decision, broader synthetic graph fixtures, repeated-output determinism check, crowded-label tests and visual review at varied sizes.
