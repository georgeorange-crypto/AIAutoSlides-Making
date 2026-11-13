# Local PDF image extraction slice

Status: **implemented and locally verified for bounded PDF image XObjects and inline images**.

## Workflow

```powershell
node src/import-document.mjs --input source.pdf --id E_LOCAL_PDF --extract-images --out-prefix outputs/imports/source
```

PDF.js walks each page operator list and resolves image XObjects and inline-image operators, then converts supported decoded 1-bit grayscale, RGB, and RGBA data to PNG. It does not save page screenshots or original compressed streams. Repeated placements with identical decoded pixels deduplicate by PNG SHA-256 while preserving each page/operator location, including inline-image provenance and a hash of its decoded source bytes. `*.assets.json` records source PDF SHA-256, page/operator/object identifiers, decoded content hash, output hash, rights inherited as pending, and `verified:false`. The existing asset manifest can associate imported images to `slide_id` and embed them in PPTX.

All processing is local. Limits: 100 MB source, 500 pages, 100 image placements, 12 million pixels per image, 25 MB source image data, and 50 MB extracted output. PDF.js evaluation/XFA are disabled. A textless scanned PDF may produce a zero-text source bundle when `--extract-images` is requested; OCR remains a separate explicit option.

## Verification

- A synthetic inline-image PDF verified PNG decoding, page/operator provenance and source-pixel hashing. The full document-import suite is rerun for this follow-on stage below.
- Full `npm run check`: **exit 0; 141/141 tests passed**, including current chart, importer, synthetic deck generation, critique, build and QA workflow.
- `npm run preview`: PowerPoint 16.0 and Poppler 26.07 rendered the 7-slide deck to PDF/PNG; `src/qa.mjs` found 7 text-editable slides and one native chart, with expected warnings for unverified example data.
- All 7 rendered PNG pages were opened and reviewed. Pages 2–7 show no apparent clipping. Page 1 has a pre-existing cover title extending into the right decorative panel. This issue is recorded, not silently treated as fixed. No human design sign-off was obtained.

## Not implemented

- Masks/soft masks, uncommon sample formats, vector drawing extraction, semantic matching, and OCR-to-figure association.
- DOCX header/footer images, external asset harvesting, license verification, or image content classification.
- The extracted image remains a replaceable/croppable PPTX picture, not converted into editable native shapes. Extraction alone never marks evidence verified.

## Inline image follow-on — 2026-11-12

- Added bounded decoding for PDF.js `paintInlineImageXObject` and grouped inline-image operators. The extractor writes PNG pixels and preserves page, operator index/name, inline-image marker, placement index, and a hash of PDF.js decoded source bytes; output assets remain `verified:false`.
- `npm run test`: **182/182 passed**, including generated one-pixel RGB inline-image and ten repeated-placement PDF fixtures that verify PNG output, deduplication, and source locators.
- PDF.js's grouped-inline-image operator branch is handled in the extractor but was not triggered by these fixtures; it does not have an independent regression fixture yet.
- `npm run validate`, `npm run build`, `node src/qa.mjs outputs/research-demo.pptx`, and `npm run preview`: all exited 0. QA found seven editable slides and one native chart. PowerPoint 16.0 and Poppler 26.07.0 rendered seven PNG pages; all seven were opened and visually reviewed with no apparent text clipping. The existing sample-size and unverified-source warnings remain. No human design sign-off was recorded.
