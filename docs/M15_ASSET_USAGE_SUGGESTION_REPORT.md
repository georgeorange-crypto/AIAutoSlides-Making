# Deterministic asset usage suggestions

Status: **implemented as metadata-based candidate ranking; semantic matching remains unimplemented**.

`src/asset-suggest.mjs` adds a local CLI for a validated storyboard and local asset manifest. For each slide it tokenizes title, assertion, kicker, body, and speaker notes; it compares the resulting terms with asset ID plus optional `description`, `alt_text`, `title`, and `keywords[]`. Results are sorted by number of exact token matches, then asset ID, and include matched terms, existing asset IDs, source/license text, verification and rights-review state, and review flags.

The command only writes a separate report. It does not modify the storyboard, apply placements, inspect image pixels, infer claim support, validate a license, or change verification status. Exact token overlap is a transparent heuristic; morphology, synonyms, captions in pixels, and narrative context can be missed. Existing manifest validation still blocks missing files, hashes, source, or license fields before suggestions can be produced.

## Example

```powershell
npm run assets:suggest -- --storyboard examples/multimodal/storyboard.json --assets examples/multimodal/assets.json --out outputs/multimodal/asset-suggestions.json
```

## Verification

- Focused asset suggestion and manifest tests: 8/8 passed before the final additional license warning; the focused suggestion test then passed 1/1 after that change.
- Full `npm test`: 159/159 passed after the final additional license warning.
- `npm run validate` and `npm run build` exited 0 (7-slide sample; 3 existing evidence/sample-size warnings).
- Sample report generated for all 10 synthetic AI Systems slides. The output kept existing storyboard associations unchanged and marked human review required.
- `npm run preview` used PowerPoint 16.0 and Poppler 26.07.0 to render the 7-slide demo to PDF and PNG. All seven pages were opened and visually inspected; no apparent clipping/overlap was found. `node src/qa.mjs outputs/research-demo.pptx` reported 7 text-editable slides and one native chart with expected warnings. This is not scientific or human approval.
