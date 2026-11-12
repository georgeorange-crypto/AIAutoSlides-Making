# Existing PPTX selective text edit

This local workflow makes a new copy of an existing deck and replaces exact text in a single editable OOXML text run on selected slides. It leaves the source file untouched and verifies that every unedited slide XML part is byte-identical. When a renderer is available, it also creates source/output previews and requires identical PNG hashes for untouched pages.

## Run the synthetic fixture

```powershell
npm run fixture:existing-pptx
npm run workflow:existing-pptx -- --input examples/existing-pptx/fixtures/template.pptx --request examples/existing-pptx/request.json --out outputs/existing-pptx/revised.pptx
```

To skip the host renderer for a contract-only run, add `--skip-preview`. That skips before/after pixel comparison and is not visual preservation evidence.

## Edit request

```json
{
  "edits": [
    { "slide": 2, "find": "Exact existing text", "replace": "Replacement text" }
  ]
}
```

Slide numbers follow `ppt/presentation.xml` relationship order. Each target must occur exactly once in one `<a:t>` run. Requests are limited to 20 edits and 300 characters per old/new string. The CLI rejects writing to the source path, invalid slide order, missing/ambiguous text and oversized (>250 MiB) decks. The source bytes are hashed before editing and the output is written to a separate path.

## Preservation and limitations

The OOXML package is unpacked/repacked and all parts other than selected slide XML are retained. The edit report records source/output hashes, per-slide XML hashes, edited slide IDs, QA state, renderers and untouched-page comparisons. Package-part preservation is not a guarantee that every vendor-specific extension, signature, animation or advanced feature will round-trip. It edits text only, not charts, images, masters or notes; typography/geometry is unchanged, so review the edited page for overflow. The upstream `pptx-automizer` candidate remains catalogued and is not claimed as the implementation here.
