# DOCX referenced header/footer text extraction

Status: **implemented for paragraphs in internal header/footer parts referenced by the main document**.

The local DOCX text importer now resolves `w:headerReference` and `w:footerReference` through `word/_rels/document.xml.rels`. It includes only internal, path-contained `word/headerN.xml` and `word/footerN.xml` parts actually referenced by the document; orphan and external parts are excluded. Main-body locators remain `paragraph N`. Header/footer locators identify the package part and paragraph (for example `header 1.xml paragraph 1`). Extracted text remains unverified evidence and is marked as source data requiring human review.

Tables continue to be linearized. Comments, tracked-change deletion semantics, field evaluation, and visual positioning are not interpreted.

## Verification

- Focused `node --test tests/document-import.test.mjs`: **13/13 passed**. Synthetic DOCX checks body locator stability, header/footer text, relationship resolution, orphan-part exclusion, source Markdown and evidence bundling.
- Full `npm test`, `npm run validate`, and `npm run build` results are recorded after the final run below.
- The first preview attempt had previously timed out in PowerPoint COM, but the final preview rerun below succeeded in PowerPoint. LibreOffice remains unavailable on PATH.

## Verification update

- `npm test`: **158/158 passed**.
- `npm run validate`: exit 0; 7 slides, with the same 3 warnings for missing chart sample size and unverified example evidence.
- `npm run build`: exit 0; 7-slide editable PPTX created.
- `npm run preview`: exit 0 using PowerPoint 16.0 and Poppler 26.07.0; PDF and seven PNG pages rendered. `node src/qa.mjs outputs/research-demo.pptx` reported 7 text-editable slides and 1 native chart with expected warnings.
- All seven current PNG pages were opened and inspected; no apparent clipping or overlap. The cover title remains within the left column. Human visual approval and scientific verification remain pending.
