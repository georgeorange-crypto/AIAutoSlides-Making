---
title: "KV recovery review: a cautious research outline"
subtitle: "Markdown-to-storyboard example"
audience: "Research group"
audience_profile: research_group
goal: "Review the current evidence and agree on a profiling experiment"
duration_minutes: 7
theme: tech-dark
status: "DRAFT — source verification pending"
---
## S01 cover
### kicker
RESEARCH REVIEW
### title
What does the current KV recovery evidence support?
### body
- Separate reported measurements from verified findings
- Agree on the next measurement before optimizing
### evidence_ids
E1, E2

## S02 statement
### kicker
REPORTED OBSERVATION
### title
The current summary reports a large gap between raw and compressed cache hits
### body
- The experiment summary has not been independently checked against raw logs
- Treat its values as provisional until the run metadata and units are confirmed
### evidence_ids
E1
### speaker_notes
State that this is a reported observation and name the missing verification step.

## S03 statement
### kicker
WHAT WE KNOW
### title
The current evidence ledger distinguishes a reported result from a hypothesis
### body
- E1 points to user-supplied experiment values
- E2 is a proposed profiling direction, not a measured outcome
### evidence_ids
E1, E2

## S04 bullets
### kicker
VERIFY FIRST
### title
Resolve the evidence gaps before making a performance claim
### body
- Match each value to its source log and experiment configuration
- Confirm the aggregation method, sample counts, and units
- Preserve the raw observations and transformation steps
### evidence_ids
E1

## S05 statement
### kicker
LIMITATION
### title
One summary cannot establish repeatability or causation
### body
- No distribution or uncertainty estimate is available in the current evidence entry
- The measured request path needs to be separated into components
### evidence_ids
E1, E2

## S06 bullets
### kicker
NEXT EXPERIMENT
### title
Trace recovery stages under a matched workload
### body
- Record per-part payload, decode, transfer, and synchronization spans
- Compare sequential and batched paths with the same request set
- Validate recovered KV correctness before interpreting latency
### evidence_ids
E2

## S07 statement
### kicker
DECISION
### title
Prioritize an auditable recovery trace before tuning compression
### body
- Keep the claim provisional until the trace is repeated and checked
- Publish the source manifest with the eventual chart
### evidence_ids
E1, E2
### speaker_notes
Ask whether the group agrees to the profiling design and correctness gate.

## S08 closing
### kicker
DISCUSSION
### title
Which measurement should be added to the next run?
### body
- Choose a request identity and matched workload for the paired trace
### evidence_ids
E2
