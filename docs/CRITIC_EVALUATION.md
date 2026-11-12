# Slide Critic claim review evaluation

Cases: **24**

Annotation: Hand-labeled synthetic cases; labels represent required review states, not semantic truth judgments.

Scope: Classification of explicit claim-to-source review states only; not semantic truth or support detection.

| Rule | TP | FP | FN | TN | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|---:|
| CLAIM-001 | 6 | 0 | 0 | 18 | 100.0% | 100.0% | 100.0% |
| CLAIM-002 | 6 | 0 | 0 | 18 | 100.0% | 100.0% | 100.0% |
| CLAIM-003 | 6 | 0 | 0 | 18 | 100.0% | 100.0% | 100.0% |

## Interpretation

The cases are hand-labeled synthetic software fixtures (English and Chinese claim wording), not a sample of real slide decks. These metrics show whether the implementation matches the stated review-state contract on this fixture set; they do **not** estimate real-world critic accuracy, semantic entailment, or scientific truth.

| Case | Expected rules | Detected rules |
|---|---|---|
| missing-en-01 | CLAIM-001 | CLAIM-001 |
| missing-en-02 | CLAIM-001 | CLAIM-001 |
| missing-en-03 | CLAIM-001 | CLAIM-001 |
| missing-en-04 | CLAIM-001 | CLAIM-001 |
| missing-zh-01 | CLAIM-001 | CLAIM-001 |
| missing-zh-02 | CLAIM-001 | CLAIM-001 |
| pending-en-01 | CLAIM-002 | CLAIM-002 |
| pending-en-02 | CLAIM-002 | CLAIM-002 |
| pending-en-03 | CLAIM-002 | CLAIM-002 |
| pending-en-04 | CLAIM-002 | CLAIM-002 |
| pending-zh-01 | CLAIM-002 | CLAIM-002 |
| pending-zh-02 | CLAIM-002 | CLAIM-002 |
| conflict-en-01 | CLAIM-003 | CLAIM-003 |
| conflict-en-02 | CLAIM-003 | CLAIM-003 |
| conflict-en-03 | CLAIM-003 | CLAIM-003 |
| conflict-en-04 | CLAIM-003 | CLAIM-003 |
| conflict-zh-01 | CLAIM-003 | CLAIM-003 |
| conflict-zh-02 | CLAIM-003 | CLAIM-003 |
| reviewed-en-01 | — | — |
| reviewed-en-02 | — | — |
| reviewed-en-03 | — | — |
| reviewed-en-04 | — | — |
| reviewed-zh-01 | — | — |
| reviewed-zh-02 | — | — |
