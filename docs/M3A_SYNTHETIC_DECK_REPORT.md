# Milestone 3A acceptance — synthetic AI Systems deck

Date: 2026-11-12 · Scope: verify the 10-slide local synthetic presentation end to end.

## Inputs

- `examples/multimodal/technical-introduction.md` — scenario and claim boundaries.
- `examples/multimodal/synthetic-latency.csv` — three explicitly hypothetical values, one row per condition.
- `examples/multimodal/architecture.json` — groups, nodes and directed edges.
- `examples/multimodal/assets.json` — two original local SVG illustrations with SHA-256, source, and CC0-1.0 license labels. `verified:false` remains in effect until a person confirms provenance and licensing.
- `examples/multimodal/storyboard.json` and `evidence.json` — ten slides with source IDs and speaker notes.

The whole example is labeled `SYNTHETIC / HYPOTHETICAL`. It makes no empirical performance or deployment claim.

## Delivered files

The reproducible local output set is in `outputs/multimodal/`:

- `ai-systems-synthetic.pptx` — editable deck with native chart, architecture shapes/connectors, text and speaker notes; the two SVGs are embedded as picture objects.
- `ai-systems-synthetic.pdf` and `ai-systems-synthetic-page-01.png` through `-page-10.png` — PowerPoint 16.0 and Poppler renders.
- `ai-systems-synthetic.preview.json` — renderer, page list and deck hash.
- `ai-systems-synthetic.evidence-manifest.json` — slide source lineage, chart and diagram mappings, two assets, hashes, licenses, verification states and slide associations.
- `ai-systems-synthetic.qa.json` and `.qa.md` — machine findings and separate page-by-page visual-review state.

Rebuild from the repository root:

```powershell
node src/cli.mjs validate --input examples/multimodal/storyboard.json --evidence examples/multimodal/evidence.json --assets examples/multimodal/assets.json
node src/cli.mjs build --input examples/multimodal/storyboard.json --evidence examples/multimodal/evidence.json --assets examples/multimodal/assets.json --out outputs/multimodal/ai-systems-synthetic.pptx
node scripts/preview.mjs outputs/multimodal/ai-systems-synthetic.pptx --renderer auto
node src/qa.mjs outputs/multimodal/ai-systems-synthetic.pptx
```

## Verification

| Check | Result |
|---|---|
| Validation | Passed: 10 slides. Warnings correctly preserve unverified technical text, synthetic CSV data and hypothetical architecture state. |
| Structural QA | 0 errors; 10 slides, 1 native chart, 153 native shapes and 28 connector objects. Evidence warnings remain visible. |
| Assets and lineage | 2 local SVG picture objects with source/license/hash and slide IDs S02 and S06; 10 slide records, 1 figure record and 1 native architecture record. |
| Render | PowerPoint 16.0 produced PDF; Poppler 26.07 produced all 10 page PNGs. The PDF and all PNGs were opened and visually inspected. No clipping or missing pages observed. |
| QA review state | Render manifest matches the built deck. Page review remains `pending` because no named human reviewer has recorded a decision; visual inspection in this engineering pass does not impersonate that sign-off. |
| Full project checks | The latest shared-worktree `npm run check` run reached 111 tests: 110 passed and one unrelated uncommitted local API test failed (`tests/api.test.mjs`: create-project returned HTTP 500 instead of 201). The earlier Slidev IR assertion wording failure is resolved. The complete downstream check chain stopped at the test stage. Asset/code/timeline focused tests passed separately (8/8). |

## Remaining limits

- SVG assets remain single PowerPoint picture objects; their internal vector paths are not native editable shapes.
- Asset attribution strings say CC0-1.0, but `verified:false` correctly means a human still needs to confirm authorship and rights.
- The chart intentionally has one synthetic observation per condition and supports no statistical or performance conclusion.
- Machine QA cannot decide whether the narrative and visuals are scientifically appropriate. A named reviewer must record the final decision for every slide.
