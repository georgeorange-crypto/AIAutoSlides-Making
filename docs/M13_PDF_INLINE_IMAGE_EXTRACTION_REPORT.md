# PDF inline-image extraction

Status: **implemented and integration-tested for PDF.js inline image and inline image group operators**.

The existing local image importer now handles `paintInlineImageXObject` and `paintInlineImageXObjectGroup` alongside image XObjects. It converts decoded 1-bit grayscale/RGB/RGBA samples through the same bounded PNG path. Page number and operator index are preserved; image-group records also retain placement count. Identical output pixels are content-deduplicated while keeping all source operator references. The output remains `verified:false` with rights inherited as pending. No page screenshots are substituted for image data; extraction remains local.

## Verification

- `node --test tests/document-import.test.mjs`: **13/13 passed**. A synthetic PDF contains two repeated inline image placements; extraction deduplicates the pixels, retains both operator/group placements, checks decoded PNG RGBA bytes, imports through the CLI, and verifies the embedded PPTX picture object.
- `npm test`: **158/158 passed**.
- `npm run validate`: exit 0, 7 slides, with 3 expected evidence/sample-size warnings.
- `npm run build`: exit 0, created the 7-slide native editable PPTX; `node src/qa.mjs outputs/research-demo.pptx` found 7 text-editable slides and one native chart, with review warnings.
- `npm run preview`: **failed**. PowerPoint COM timed out and LibreOffice is not installed on PATH. The preview manifest is explicitly `status: failed`; no fresh PDF/PNG render was available for this stage. Visual review is therefore pending. This is an environment/renderer blocker, not a passing preview claim.

## Limits

- PDF image masks/soft masks, uncommon color/sample formats, vector drawings, and OCR-to-figure association are still unsupported.
- This creates a replaceable/croppable PPTX image object; it does not convert pixels into editable diagram shapes or infer figure meaning/licensing.
- Automatic scientific/rights verification remains out of scope. DOCX referenced header/footer text extraction is implemented in M14.

## Preview rerun on the M14 descendant

The preview that failed during the original M13 commit was retried after DOCX header/footer text work: PowerPoint 16.0 and Poppler 26.07.0 successfully rendered the current seven-slide deck, and all seven pages were visually reviewed. See M14 report for the current full verification. M13's original test snapshot is retained as history.
