# Presentation IR → Slidev mapping (phase 3)

This is a deliberately bounded renderer adapter, not a complete implementation of every Presentation IR field. `packages/adapters/slidev-ir.mjs` compiles schema version `1.0.0` into Slidev Markdown and a lineage sidecar. `scripts/slidev-from-ir.mjs` is the local conversion CLI. The existing Slidev export adapter copies the sidecar and validates it against every PPTX notes slide before reporting success.

## Supported IR elements

| Element kind | Slidev mapping | PowerPoint result |
|---|---|---|
| `text`, `bullets`, `table`, `cards`, `callout` | Markdown or small HTML layout | Editable text/basic shapes where Slidev supports conversion |
| `mermaid` | Mermaid code block | May be a picture; one object is selectable, diagram primitives are not native shapes |
| `chart` | Deterministic SVG fallback with exact series data also recorded in the lineage sidecar | Not a native PowerPoint chart; treat as a visual fallback only |

Unknown element kinds fail closed. Existing assets, arbitrary transforms/layout geometry, full native chart objects, and round-trip import are not mapped in this phase. Chart values require an evidence/source ID. Chart fallback does not turn unverified sources into verified evidence and does not satisfy the core native-chart acceptance criterion.

## Validation and lineage

The converter checks version, required structure, unique source/slide/element IDs, source verification states, numeric chart values, and all cited/source IDs. It records source verification state, per-slide evidence IDs, and per-element source IDs in `slide-lineage.json`; when an element has no explicit source IDs it inherits the slide's evidence IDs. The generated speaker notes repeat this mapping. After PPTX export, the adapter checks notes-slide count/order and exact slide/evidence/element-source IDs. Missing or mismatched lineage fails the export. The validator checks metadata presence and mapping consistency; it does not judge whether a cited source supports the prose claim.

## Reproduction

```powershell
node scripts/slidev-from-ir.mjs --input examples/open-source-bakeoff/synthetic-presentation-ir.json --out outputs/open-source-bakeoff/ir-generated
$env:SLIDEV_CLI = (Resolve-Path outputs/m4/slidev-lab/node_modules/@slidev/cli/bin/slidev.mjs).Path
$env:SLIDEV_CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
node scripts/run-slidev-backend.mjs --input outputs/open-source-bakeoff/ir-generated/presentation.md --out artifacts/open-source-bakeoff/slidev-ir --formats pptx-editable,pdf,png --lineage outputs/open-source-bakeoff/ir-generated/slide-lineage.json --project-dir outputs/m4/slidev-lab --timeout 120000 --wait-until networkidle
node src/qa.mjs artifacts/open-source-bakeoff/slidev-ir/presentation.pptx
```

The synthetic 9-slide IR fixture keeps `E_SYN_01` marked `unverified`. IR-to-Markdown conversion emitted nine slides and an explicit unverified-source warning. An initial Windows PPTX export using `--wait-until load` produced no editable text and was rejected by lineage validation. Retrying with `--wait-until networkidle` completed the full loop using Slidev 53.1.0: PPTX, PDF, 9 PNGs; strict lineage passed 9/9; structural QA reported 9 text-editable slides, 79 native shapes, 1 picture, and 0 native charts. Artifacts and hashes are retained under [`artifacts/open-source-bakeoff/slidev-ir/`](../artifacts/open-source-bakeoff/slidev-ir/).

The isolated Slidev package directory is also the render working directory so theme/package resolution is deterministic. The exporter timeout and browser wait event are explicit CLI options and are recorded in the backend manifest. On this Windows host `load` returned before rendering completed; `networkidle` was needed for the accepted export. Always run object QA and lineage checks on fresh files.

## Visual QA

Each of the nine PNG pages was opened and reviewed. No clipping, unintended visual overlap, missing slide, or unreadable body text was observed. Slide 8 has substantial unused whitespace, and the cover title wraps to two lines; default theme styling remains sparse. The Mermaid diagram is one image; there are no footers/page numbers; source IDs are in notes/sidecar, not a visible footer. The synthetic table is legible and retains units. Machine QA flagged text-box overlaps on slides 6 and 8, but visual review found the text items separated; machine findings remain visible in its report. Page-level findings are recorded in [`slidev-ir-visual-qa.md`](../artifacts/open-source-bakeoff/slidev-ir/slidev-ir-visual-qa.md).
