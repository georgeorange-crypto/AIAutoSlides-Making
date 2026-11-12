# Milestone 3A — richer AI storyboard contract

Date: 2026-11-12 · Scope: enrich the opt-in AI storyboard plan while preserving local validation and explicit human approval.

## Implemented

- The strict planner schema now requests a narrative structure and rationale, plus per-slide assertion, supported layout, evidence IDs, visual needs, and speaker notes.
- The prompt carries the selected audience, goal, duration and known evidence IDs. It prohibits invented measurements, citations, experiments and conclusions; proposed data figures carry no generated values.
- The response is normalized into a draft marked `requires_human_review:true`. Existing validation rejects unknown evidence IDs. Existing approval still binds the editable reviewed copy to its content hash.
- `visual_needs` are stored in the storyboard for human follow-up; they do not claim to fetch, license, generate or embed assets. The AI slide types remain cover, statement, bullets and closing.
- A pure local contract module makes the schema/prompt and draft normalization testable without credentials or network access.

## Verification

| Check | Result |
|---|---|
| Focused planner tests | Passed: 3/3, including required fields, draft review state, preservation of notes/visual needs and rejection of fabricated evidence IDs. |
| Planner help | Passed locally; no key required to inspect usage. |
| Paid API call | Not made. The planner remains explicitly opt-in and may incur provider charges. |
| Full project tests | Latest shared-worktree run: 115/116 passed. The unrelated uncommitted `tests/api.test.mjs` API lifecycle case observed job state `running` when it expected `completed`. |

## Limits

The planner still emits no charts, metrics, architecture, process, table, code or timeline objects. Visual-need suggestions may be irrelevant and require human review. Evidence IDs establish ledger membership only, not claim entailment or source truth. Generated notes and prose remain draft content; approve only after checking claims, citations, layout and render.
