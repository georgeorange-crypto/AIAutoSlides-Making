# Local PDF image XObject extraction slice

Status: **implemented and locally verified for bounded PDF image XObjects**.

## Workflow

```powershell
node src/import-document.mjs --input source.pdf --id E_LOCAL_PDF --extract-images --out-prefix outputs/imports/source
```

PDF.js walks each page operator list and resolves image XObjects, then converts supported decoded 1-bit grayscale, RGB, and RGBA data to PNG. It does not save page screenshots or original compressed streams. Repeated placements with identical decoded pixels deduplicate by PNG SHA-256 while preserving each page/operator location. `*.assets.json` records source PDF SHA-256, page/operator/object identifiers, decoded content hash, output hash, rights inherited as pending, and `verified:false`. The existing asset manifest can associate imported images to `slide_id` and embed them in PPTX.

All processing is local. Limits: 100 MB source, 500 pages, 100 image placements, 12 million pixels per image, 25 MB source image data, and 50 MB extracted output. PDF.js evaluation/XFA are disabled. A textless scanned PDF may produce a zero-text source bundle when `--extract-images` is requested; OCR remains a separate explicit option.

## Verification

- `node --test tests/document-import.test.mjs`: **12/12 passed**, including a generated image-only PDF, duplicate placement deduplication, manifest provenance, asset loading, PPTX picture embedding, and text-only PDF rejection.
- Full `npm run check`: **exit 0; 141/141 tests passed**, including current chart, importer, synthetic deck generation, critique, build and QA workflow.
- `npm run preview`: PowerPoint 16.0 and Poppler 26.07 rendered the 7-slide deck to PDF/PNG; `src/qa.mjs` found 7 text-editable slides and one native chart, with expected warnings for unverified example data.
- All 7 rendered PNG pages were opened and reviewed. Pages 2–7 show no apparent clipping. Page 1 has a pre-existing cover title extending into the right decorative panel. This issue is recorded, not silently treated as fixed. No human design sign-off was obtained.

## Not implemented

- At the M10 stage PDF inline images were unsupported; inline image and image-group operators were implemented later in M13. Masks/soft masks, uncommon sample formats, vector drawing extraction, semantic matching, and OCR-to-figure association remain unsupported.
- DOCX header/footer images, external asset harvesting, license verification, or image content classification.
- The extracted image remains a replaceable/croppable PPTX picture, not converted into editable native shapes. Extraction alone never marks evidence verified.
