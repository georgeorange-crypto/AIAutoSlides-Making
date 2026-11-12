# Research presentation brief (demonstration)

Audience: AI systems research group. Goal: summarize a storage/latency tradeoff and ask for a decision on the next optimization experiment. Duration: approximately 7 minutes. Do not claim generalization beyond one recorded setup.

## Observations from an example experiment report

- Qwen3-32B tensor parallelism 4 used for paired cache measurements.
- Raw cache miss TTFT P50: 0.369 seconds.
- Raw cache hit TTFT P50: 0.353 seconds.
- BitPack4 compressed cache hit TTFT P50: 67.792 seconds.
- Byte savings for the compression setup: 72.7%.
- Compressed reload accuracy was reported as 0.50; do not interpret this as a general model accuracy without examining the metric definition.
- Host decode wall time per part was approximately 527–587 milliseconds; the end-to-end latency cannot be explained by this number alone without counting parts and synchronization.

## Interpretation boundary

These values are an example of an existing experiment report. The deck must explain that the specific benchmark setup, sample size, and repeatability require verification before publication. Do not introduce additional empirical results.

## Ask

Prioritize critical-path instrumentation and a controlled comparison of sequential versus batched decode while preserving data correctness checks.
