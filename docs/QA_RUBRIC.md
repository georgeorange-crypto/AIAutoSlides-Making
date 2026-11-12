# QA Rubric

Apply to every generated variant; report `pass`, `fail`, `blocked`, or `not-run` with evidence paths. Structural checks and visual review are separate.

1. **Provenance and facts:** all factual slides map valid source IDs and locators; unknown IDs fail; unverified evidence remains visibly unverified; plotted values equal deterministic source transforms; no generated claim is presented as verified.
2. **Rights and privacy:** each nontrivial asset has source, creator, license/permission and review state; private inputs remain local unless explicitly authorized; no paid request without configuration and approval.
3. **Structure and editability:** record slide count; text/shape/chart/image counts; native chart workbook/value comparison; notes; editable level per output/element; raster fallback proportion. File extension alone proves nothing.
4. **Visual quality:** render all pages at fixed size/font environment; inspect every page for clipping, overlap, contrast, label readability, font substitution, hierarchy and consistency. Store renderer/version and page images. Automated geometry does not replace visual review.
5. **Narrative/accessibility:** one main assertion per factual slide, concise support, readable type, meaningful chart labels/units, chart description and usable speaker notes; check requested duration against supplied script and rate.
6. **Reproducibility:** record tool/runtime versions, configuration hash, inputs/outputs and SHA-256, transformation, warnings, duration, retries and cost. Re-run with same inputs and compare deterministic outputs where supported.
7. **Repair:** findings identify `slide_id` and `element_id`; only impacted artifacts are rebuilt; regression-check unaffected pages and retain before/after evidence.

No aggregate score may conceal a failed hard constraint. Missing external executable or authorized account is `blocked`, not pass.
