# Formal narrative-structure gate

Date: 2026-11-13

## Scope

This phase targets the missing-outline and unstructured-section failure (presentation defect 6). A formal deck plan now has to describe structure that can be checked against the final Presentation IR instead of merely listing intended sections.

## Enforced contract

- There is exactly one planned agenda page. It may follow one cover/opening page, and it must visibly list every `quality_contract.narrative_sections` entry.
- Every declared section has exactly one `section_transition` page, named with `section_name`, ordered after the agenda and before that section's content.
- Every content page maps to a declared section. Unassigned content, undeclared section names, duplicate sections, and empty sections fail plan validation.
- Each rendered section transition must visibly name its section and contain at least 18 visible text units beyond the heading. The threshold is a sparse-transition screen; it does not certify that the explanation is useful.
- Representative-slide pilots defer whole-deck agenda/section checks. The full-deck gate checks the agenda and all planned section IDs against the rendered IR.

The check is deliberately structural. A section label or agenda can still be semantically wrong; science, visual review, and per-page reviewer attestations remain required. It does not automatically insert agenda or transition pages, because those pages must be included in the approved page count and map.

## Regression evidence

Adversarial fixtures cover a missing agenda, missing/incorrect transition mapping, content with no section assignment, a transition after its content, content before the agenda, a too-thin transition, and a representative subset that must not be mistaken for the complete deck.

The reproducible visual proof uses only a synthetic source and a seven-slide IR: agenda, two section transitions, and two content pages per section. Run it with:

```powershell
node scripts/render-section-structure-fixture.mjs
```

On 2026-11-13 it generated seven PowerPoint 16.0 page images. All seven were opened and inspected. The agenda names both sections; each transition names its section and explains the section's question; content follows the matching transition. The final workflow quality gate had zero blockers and one `QUALITY_OCR_COVERAGE_LOW` warning requiring human inspection. The workflow status is `awaiting_review`; this synthetic run is not a completed or scientifically reviewed deck.

Local preview and machine report (ignored by Git): `outputs/quality-section-structure/run-2026-11-13T14-22-07-607Z/runs/synthetic-sections/`. PPTX SHA-256: `f9b706022284743fbf442b71cc9565287fac093ca7b13bc22686d70a4578a83a`.

## Remaining limits

This phase blocks absent or unmapped structure; it does not prove that the narrative order is persuasive, that section depth matches importance, or that a generated explanation is scientifically correct. Semantic organization and visual quality still require human inspection. The 18-unit threshold is only a minimum-copy guard and cannot guarantee good typography or prevent all whitespace problems.
