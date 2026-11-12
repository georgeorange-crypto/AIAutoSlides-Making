# PptxGenJS IR Assets and Diagrams

## Delivered

- Added a typed `diagram` element for architecture slides: labeled groups, 2–12 uniquely identified nodes, and directed edges. Geometry must stay within the 16:9 slide canvas; every edge must connect two distinct known nodes.
- The PptxGenJS mapping sends this structure to the existing native PowerPoint architecture renderer. Diagram boxes, labels and arrows remain editable shape objects.
- `process` elements accept 2–6 short steps. A step may carry detail text; the label remains editable on-slide and detail is retained in speaker notes.
- Added a local, project-authored SVG asset fixture. The renderer verifies its SHA-256, MIME type, workspace containment and SVG safety before embedding. Restricted assets fail closed; pending/unknown rights remain warnings.
- Added an end-to-end PPTX fixture and tests for source lineage, editable object counts, asset embedding, malformed diagram geometry/edges, invalid process steps, restricted assets and hash mismatch.

## Verification

- The focused PptxGenJS asset/diagram test file passes 4/4 tests.
- The two-slide fixture renders to PPTX with no structural errors, 19 native shapes on each slide, one embedded SVG on the diagram slide, and exact text/lineage checks. The two pages were rendered with PowerPoint 16.0 and Poppler and visually inspected.
- The fixture source is explicitly unverified and synthetic. QA warnings preserve that status and identify the embedded picture object.

## Scope limits

One structured diagram and one process group are supported per slide. Mermaid DSL in the PptxGenJS backend remains source text; it does not receive Mermaid's auto-layout or native shape conversion. Images are local workspace files only. Rights approval in a fixture is metadata, not an independent legal review.
