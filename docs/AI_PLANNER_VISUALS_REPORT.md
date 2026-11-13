# AI planner visual materialization evidence

Date: 2026-11-13

Scope: Offline, synthetic fixture proving that structured AI storyboard process and architecture requests are rendered into native editable PowerPoint objects.

## Reproduce

```powershell
node scripts/render-ai-planner-visual-fixture.mjs
node src/qa.mjs outputs/planner-visual-demo/synthetic-planner-demo.pptx
node scripts/preview.mjs outputs/planner-visual-demo/synthetic-planner-demo.pptx
```

The fixture makes no API request and contains no research data. It produces a six-slide draft with a three-step process on slide 2 and a five-node, four-edge architecture on slide 4. The planner materializes 2 of 4 explanatory slides (50%) with editable shapes. Preview images and PPTX are generated under ignored `outputs/` and are not repository inputs.

## Verified evidence

- The planner API contract test runs against a loopback stub, writes an editable draft, and confirms it remains pending human review.
- The planner visual test inspects PPTX OOXML and confirms the process steps, architecture nodes, relationship labels, and native shape objects are present.
- For both visual slides, `auditTextLayout` reports all text inside slide bounds, zero text-to-text overlaps, and no non-footer text below 12 pt.
- A PowerPoint 16.0 render produced all six PNG pages. Every page was visually inspected; slides 2 and 4 contain the generated visuals.
- The six-slide structural QA reports zero overlap pairs, zero small-text objects, and in-bounds text on all pages. QA still warns that this standalone synthetic deck lacks a build review/source-completeness report; that warning is expected and is not treated as a pass on scientific or editorial quality.

## Limits and next work

This proves one synthetic request path for editable process and architecture visuals. It does not prove generated diagrams are semantically correct, aesthetically strong for every topic, or factually supported; source-ID membership is traceability, not claim entailment. The planner deliberately fails closed for image, table, and data-figure requests it cannot materialize. Cover/closing art, section/agenda generation, full-deck composition, Chinese editorial quality, scientific verification, and representative real-user quality remain unproven and require separate implementation and human review.

## Formal Presentation IR bridge (2026-11-13)

The previously disconnected AI storyboard path now has an explicit offline bridge:

```powershell
node src/review-draft.mjs --input outputs/ai-storyboard.json --out outputs/ai-storyboard-approved.json --decision approve --reviewer "Name" --note "Reviewed the claims, sources, and draft" --ack-findings all
npm run storyboard:to-ir -- --input outputs/ai-storyboard-approved.json --evidence sources/evidence.json --out outputs/presentation-ir.json
```

The compiler refuses pending, rejected, stale, malformed, or structurally/visually blocked drafts; maps paragraph text and materialized process/architecture visuals to canonical elements; and retains the evidence IDs and each ledger verification state. Test fixtures label their approval as synthetic. This step does **not** constitute scientific claim verification or Harness visual review. `node src/harness.mjs run --task-type ppt ...` still requires an approved content-bound deck plan, representative-slide render review, and the subsequent workflow review gates.

Adversarial checks in `tests/approved-storyboard-ir.test.mjs` cover pending approval, post-approval edits, malformed evidence metadata, valid IR and lineage, native process/diagram materialization, both explanatory paragraphs reaching the rendered PPTX, the CLI path, and the Harness gate. The six-slide synthetic IR fixture was rendered through the presentation workflow to PowerPoint 16.0 PNG previews and all six pages were inspected. Inspection found relationship labels colliding with architecture nodes in the generic architecture layout. The IR adapter now routes AI planner diagrams carrying a visual description through the panel renderer, which presents labeled relationships in a separate legend; the rerendered architecture page was inspected and those labels no longer overlap the nodes. Inspection also found that the legacy process renderer dropped the second explanatory paragraph; the process layout now renders both paragraphs, and a PPTX XML regression check confirms both are present. The run remains `awaiting_review`, as expected for a synthetic proof without a real deck plan or reviewer.

This is evidence that the approved planner output now reaches the formal IR and rendering path and that one observed diagram collision was repaired. It does not guarantee attractive results for arbitrary content, guarantee semantic correctness of generated relationships, or remove the need to inspect every real deck.

## Architecture relationship gate (2026-11-13)

The legacy storyboard validator and canonical Presentation IR validator share `auditArchitectureGraph`: each diagram needs at least two non-placeholder nodes, one or more action-labeled relationships, and a connected graph. The AI planner uses the same checks with its stricter range of 3–6 nodes and 2–6 relationships. Its prompt and JSON contract state these requirements, and the diagram renderer shows each relationship with its endpoint names in the separate legend.

Adversarial checks cover noun-only labels (`request`, `dispatch`), generic placeholders (`Node 2`), disconnected components, and unlabeled/unknown endpoints; valid synthetic action labels compile to native editable shapes. This prevents unlabeled chains and several obvious placeholder diagrams from passing the generation gate. A short multilingual verb vocabulary can reject valid domain-specific relations or accept a grammatically valid but factually wrong relation. It does not reason about real architecture, evidence entailment, or beauty; human system and page review remain required.

Verification for this phase: targeted architecture/IR/workflow tests passed 55/55; full `npm test` passed 284 tests, failed 0, and skipped 11 optional-tool checks because their local workers are not installed. `npm run validate` passed with three existing evidence/sample-size warnings. A synthetic six-slide architecture fixture was rendered through PowerPoint 16.0 and Poppler 26.07.0; all six previews were inspected, including the architecture page, where endpoint-labeled relationships remain legible without colliding with nodes. The standard seven-slide demo also built to `outputs/architecture-logic-phase/research-demo.pptx`; structural QA reports 7 editable text slides and 1 native chart. These checks do not substitute for human review of whether a real system diagram is true.

## Disclaimer overload gate (2026-11-13)

The formal quality audit now blocks a content page with three or more recognizable disclaimer-style clauses, and blocks an identical caveat sentence repeated on three or more content pages. One specific limitation remains allowed. The patterns cover common English forms (for example, “does not prove”) and Chinese forms (for example, “不代表” and “不能证明”). Findings name affected slide IDs and recommend consolidating repeated caveats so the page can explain its evidence or mechanism.

Adversarial tests confirm a single specific limitation passes, three stacked caveats block, and repeated boilerplate across three pages blocks; a formal workflow test confirms the finding reaches `workflow.critique.json` and sets `quality_gate_status=fail`. Targeted Harness/quality tests passed 17/17; full `npm test` passed 286, failed 0 and skipped 11 optional-tool checks. `npm run validate` passed with the same three existing warnings; the seven-slide synthetic demo built and structural QA found 7 editable text slides and 1 native chart. A real three-slide PowerPoint 16.0 / Poppler 26.07.0 Harness preview at `outputs/caveat-overload-phase/harness/runs/proof/` was inspected page by page: the visible chart-page copy contained the three targeted caveats, OCR detected it, and the formal report listed `QUALITY_CAVEAT_OVERLOAD` on S02. This lexical gate cannot establish whether one caveat is necessary or catch every paraphrase; the per-page `caveat_relevance` human review remains mandatory.

## Source-linked cover visual (2026-11-13)

When an approved planner storyboard contains a structured process, the IR compiler now carries its first three steps into a native editable cover visual and adds the same source IDs to the cover. The PptxGenJS adapter preserves that provenance and the renderer displays three numbered cards in the cover's right panel instead of the unrelated circle motif. Storyboards without a supported process keep the old cover layout; this feature does not synthesize subject-specific artwork or repair all cover styles.

`tests/approved-storyboard-ir.test.mjs` checks the cover process element, source references, mapped content and actual PPTX slide XML. The latest synthetic six-page IR run was rendered in PowerPoint 16.0; all pages were inspected. Structural QA reported no errors, no text overlaps, no out-of-bounds text and no non-footer text below 12 pt. The run remains `awaiting_review` and retains the expected `E_SYN` unverified-source warning. Previews are under ignored `outputs/approved-storyboard-ir-fixture/run-4/`; they are local generated artifacts and are not committed.
