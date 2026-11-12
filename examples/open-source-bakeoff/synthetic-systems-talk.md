---
theme: default
title: Synthetic Local-First Presentation Pipeline
info: Synthetic/hypothetical technical talk. No measured research results.
class: text-left
highlighter: shiki
fonts:
  sans: Arial
---

<style>
.slidev-layout.cover h1 {
  font-size: 3.4rem !important;
  line-height: 1.08 !important;
  max-width: 80%;
}
.slidev-layout.cover h1 + p {
  font-size: 1.35rem;
  max-width: 78%;
}
</style>

# Synthetic local-first presentation pipeline

### A hypothetical systems design for evidence-preserving technical talks

**SYNTHETIC / HYPOTHETICAL TEST MATERIAL** · 9-slide backend bake-off

<!--
slide_id: S01 | evidence: E_SYN_01 | pending verification; synthetic test copy
SPEAKER NOTES: This is a fictional architecture exercise. No performance result is measured or claimed.
SOURCE: examples/open-source-bakeoff/synthetic-systems-talk.md
-->

---

# Design the pipeline around evidence

## Problem

Presentation tools can draft and arrange slides, while scientific review needs exact data mapping, source lineage, and explicit uncertainty.

## Test question

Can independent render backends produce the same editable talk without changing the evidence meaning?

<div class="absolute bottom-10 text-sm opacity-60">SYNTHETIC / HYPOTHETICAL · no empirical performance data</div>

<!--
slide_id: S02 | evidence: E_SYN_01 | pending verification; synthetic test copy
SPEAKER NOTES: Compare the rendering result with the fixed test question. This is hypothetical content, not empirical research.
-->

---

# Separate evidence from presentation layout

```mermaid
flowchart LR
  A[Source files] --> B[Evidence ledger]
  B --> C[Storyboard + figures]
  C --> D[Backend adapter]
  D --> E[PPTX / PDF / HTML]
  C --> F[Source manifest + QA]
  E --> F
```

Evidence status and source IDs travel beside the rendered deck.

<!--
slide_id: S03 | evidence: E_SYN_01 | pending verification; synthetic test copy
SPEAKER NOTES: The diagram expresses the proposed adapter boundary. The diagram itself is illustrative and not evidence of an implemented system.
-->

---

# Keep figures deterministic

| Figure field | Hypothetical input |
| --- | ---: |
| Load tier A | 120 req/s |
| Load tier B | 240 req/s |
| Load tier C | 360 req/s |

**These values are synthetic fixture values, not benchmark results.** A renderer must preserve the values exactly and label the units.

<!--
slide_id: S04 | evidence: E_SYN_01 | values are synthetic fixture values
SPEAKER NOTES: The 120, 240, and 360 req/s values are invented test inputs only. They are not observations or benchmark results.
-->

---

# Layout intent should survive backend changes

<div class="grid grid-cols-3 gap-4 mt-8">
<div class="p-5 rounded bg-blue-100 text-blue-950"><b>Assertion</b><br>One claim per slide</div>
<div class="p-5 rounded bg-green-100 text-green-950"><b>Evidence</b><br>Show source and data</div>
<div class="p-5 rounded bg-amber-100 text-amber-950"><b>Review</b><br>Keep caveats visible</div>
</div>

SYNTHETIC DESIGN EXAMPLE · no measured results

<!--
slide_id: S05 | evidence: E_SYN_01 | pending verification; synthetic design example
SPEAKER NOTES: These cards illustrate intended semantic roles. They do not assert a measured design benefit.
-->

---

# Track limitations as structured output

- Unsupported chart type → explicit warning
- Raster-only element → object-level editability report
- Missing source ID → build error
- Unverified evidence → visible pending state
- Provider call → explicit opt-in and cost boundary

<!--
slide_id: S06 | evidence: E_SYN_01 | pending verification; synthetic test copy
SPEAKER NOTES: This list is a proposed acceptance checklist for the hypothetical system.
-->

---

# Compare capabilities, not marketing labels

| Check | Required evidence |
| --- | --- |
| Export | PPTX produced by local command |
| Editability | Text, shapes, charts inspected in package |
| Fidelity | Every rendered page reviewed |
| Lineage | Source IDs preserved in sidecar |
| Operations | Version, dependencies, external services logged |

<!--
slide_id: S07 | evidence: E_SYN_01 | pending verification; synthetic test copy
SPEAKER NOTES: These checks define what the bake-off records; the table is not claiming all backends passed.
-->

---

# A backend is useful only when its boundary is clear

**Local renderer** → repeatable exports without model calls

**AI service** → optional drafting, model/provider and cost disclosed

**Scientific QA** → stays outside the renderer and checks every output

SYNTHETIC / HYPOTHETICAL ARCHITECTURE

<!--
slide_id: S08 | evidence: E_SYN_01 | pending verification; synthetic test copy
SPEAKER NOTES: Keep local rendering, optional AI generation, and scientific QA as distinct capabilities.
-->

---

# Recommendation for this test

Keep the evidence ledger and chart data in a backend-neutral contract.

Use mature renderers through isolated adapters; promote one only after same-input, editable-object and visual checks pass.

**No backend comparison in this fixture establishes research performance.**

<!--
slide_id: S09 | evidence: E_SYN_01 | pending verification; synthetic test copy
SPEAKER NOTES: Ask reviewers to challenge the adapter boundary and the object-level acceptance criteria. The recommendation is a test-design proposal, not a research result.
SOURCE: synthetic/hypothetical only
-->
