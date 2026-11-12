# Local DOCX image extraction slice

Status: **implemented and locally verified for referenced body PNG, JPEG, and SVG assets**.

## Workflow

```powershell
npm run import:document -- --input research-paper.docx --id E_LOCAL_PAPER --extract-images --out-prefix outputs/imports/paper
```

The importer keeps text extraction behavior and adds `paper.assets/` plus `paper.assets.json`. The manifest works with the existing `--assets` option. Each unique image has a content hash, source document hash, DOCX package part and relationship IDs, alt text when present, MIME type, and `verified:false`; rights are described as inherited from the source and remain pending review. Duplicate bytes are written once. Only images referenced in `word/document.xml` are selected, and external or path-escaping relationships are ignored. Extraction is local and performs no upload or lookup.

The package filter caps source size at 100 MB, supported image parts at 50, each image at 25 MB, total extracted image bytes at 50 MB, and document relationship XML at 10 MB. PNG/JPEG signatures are checked. The asset loader rejects SVG scripts, event handlers, DTD/entity declarations, and external or data references before PPTX embedding.

## Verification

- Focused DOCX/document and asset tests: **16/16 passed**.
- Full `npm run check`: **exit 0; 135/135 tests passed**, all existing importer, chart, build and QA stages completed.
- `npm run preview`: PowerPoint 16.0 and Poppler rendered the 7-slide sample to PDF and PNG; `src/qa.mjs` reported 7 text-editable slides and one native chart.
- All 7 PNG pages were opened and inspected. Slide 1 still has a cover title intruding into the right decorative panel; this existing presentation fixture defect was not changed in the DOCX asset phase. The other six pages showed no apparent clipping or overlap. Unverified source warnings and the missing chart sample-size warning remain visible; no human sign-off was recorded.
- The integration test extracts PNG/JPEG/SVG, checks deduplication and provenance, loads the manifest, and verifies the referenced extracted PNG and SVG appear as two `<p:pic>` image objects in generated PPTX.

## Not implemented

- PDF embedded image extraction, DOCX header/footer images, OCR-to-figure association, semantic matching/placement, or license verification.
- SVG vector-to-native-shape conversion. Embedded assets remain replaceable/croppable PowerPoint picture objects.
- Images are never marked verified from extraction alone.
