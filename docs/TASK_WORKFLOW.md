# Project requirements and task isolation

This project uses two related but distinct layers: **project requirements** define the product contract; **task contracts** select the requirements and acceptance gates for one isolated piece of work. A task is not complete because its output file exists.

## Project requirement sources

Each task starts from these repository sources:

| Source | Role |
|---|---|
| [`../AGENTS.md`](../AGENTS.md) | Scientific-integrity, privacy, product-quality and Git constraints. |
| [`PROJECT_CAPABILITIES_QA.md`](PROJECT_CAPABILITIES_QA.md) | Product capability requirements and known boundaries (Q1–Q15). |
| [`REQUIREMENTS_TRACEABILITY.md`](REQUIREMENTS_TRACEABILITY.md) | Existing code, tests and evidence mapped to requirements; verify claims against the active revision. |
| [`QA_RUBRIC.md`](QA_RUBRIC.md) | Structural, provenance, editability and review quality gates. |
| [`SECURITY_MODEL.md`](SECURITY_MODEL.md) | Input trust, local processing, path and network boundaries. |

`CODEX_TASK.md` and dated implementation reports are context, not a replacement for the current user request or these requirement sources. If sources disagree, preserve the stricter scientific/privacy constraint, inspect current code, and record the discrepancy in the task result.

## One contract and workspace per task

Before changing files or starting an application job, create a task contract from [`TASK_CONTRACT_TEMPLATE.json`](TASK_CONTRACT_TEMPLATE.json). Give it a unique `task_id`; record the selected project requirement sections and the SHA-256 of each requirement document. Pin every task input by path and hash, state what is in and out of scope, and name the task's output directory and observable acceptance gates. Keep the filled contract and task artifacts in a user-designated workspace outside the Git repository (the repository ignores `outputs/` and `workspace/` for generated/local data).

Use the isolation boundary that matches the work:

| Work type | Isolation boundary |
|---|---|
| Repository/code change | A unique `codex/<topic>` branch and its own Git worktree. Preserve pre-existing dirty worktrees. Do not share a mutable checkout between concurrent tasks. |
| Local API generation/research job | An explicit `project_id` and `job_id`; retain that job's artifacts under the API workspace's `runs/<job_id>/` directory. Do not reuse another job's output path. |
| PPTX design or delivery | A task-specific deck plan and pilot/final artifacts. Include the applicable project requirement documents in the plan's `materials` with exact SHA-256 values and `read_status: "read"`; complete the Harness gates before calling the deck accepted. |
| Analysis or documentation task | A task-specific directory and contract. Cite the exact project requirements and evidence used; do not let one task's generated files become another task's inputs without explicit review. |

The local API currently provides project/job records and job-specific output paths, but it is a single-user, single-process service. Directory naming and database ownership do not provide OS-level sandboxing, multi-user authorization, or protection from another process with filesystem access. Do not describe those as implemented isolation guarantees.

## Acceptance and handoff

Write acceptance gates before implementation. Each gate must name a checkable result and how it will be verified. At handoff, record the task ID, requirement snapshot hashes, code branch/worktree or API project/job IDs, exact commands and outcomes, artifact paths/hashes, unresolved gates, and whether any external/network action occurred. Mark gates `passed`, `failed`, `blocked`, or `not_run`; never turn a skipped optional integration into a pass.

For PPT tasks, the task contract complements the deck-plan/Harness process described in [`AGENT_ONBOARDING.md`](AGENT_ONBOARDING.md) and [`API_WORKFLOW.md`](API_WORKFLOW.md); it does not replace it. Human science and visual approvals must come from the user-designated reviewer and remain bound to the final artifact hash.
