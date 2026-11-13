# AI planner API contract test

**Status:** local HTTP contract loop passed on 2026-11-12. This verifies AIAutoSlides request/response handling using a Codex-authored synthetic response fixture. It is not an external provider inference, model-quality evaluation, or API latency/cost test.

## Reproduce

```powershell
node --test tests/ai-plan-api.test.mjs
node scripts/run-ai-plan-api-poc.mjs
# Optional: use a fresh ignored output directory for another run
node scripts/run-ai-plan-api-poc.mjs --out-dir outputs/open-source-bakeoff/ai-plan-api-poc-rerun
```

The runner starts an ephemeral HTTP listener bound to `127.0.0.1`, serves one synthetic Responses API response, invokes the actual `src/ai-plan.mjs` CLI, validates the resulting storyboard, and confirms the existing human-approval build gate blocks PPTX output. It does not deploy a model, make external network calls, use private research material, or incur API charges. The key and model strings are synthetic test sentinels only.

To inspect the generated artifacts after the runner completes:

- `outputs/open-source-bakeoff/ai-plan-api-poc/storyboard.json`
- `outputs/open-source-bakeoff/ai-plan-api-poc/storyboard.json.review.json`
- `outputs/open-source-bakeoff/ai-plan-api-poc/storyboard.json.review.md`
- `outputs/open-source-bakeoff/ai-plan-api-poc/api-test-report.json`

The runner refuses to overwrite any expected output file; select a new `--out-dir` or remove only the prior generated POC directory before rerunning. All these outputs are git-ignored.

## Test fixture and request

Inputs are under [`examples/open-source-bakeoff/ai-plan/`](../examples/open-source-bakeoff/ai-plan/): a synthetic brief, one `verified:false` evidence entry, and a Codex-authored six-slide response body. The response is served exactly in the Responses API envelope as `output_text`. No model produced this response.

The actual planner CLI sent one `POST /v1/responses` request containing:

- the configured test model sentinel `synthetic-contract-model`;
- a strict JSON Schema response format;
- the planner policy and permitted evidence ID `E_SYN`;
- the synthetic brief and evidence ledger;
- a synthetic bearer token that is not printed or persisted.

The test endpoint override `AIAUTOSLIDES_TEST_RESPONSES_URL` is accepted only when `NODE_ENV=test`, only for plain HTTP loopback (`127.0.0.1`, `localhost`, or `::1`), and only at `/v1/responses`. Outside test mode, the production endpoint remains the fixed `https://api.openai.com/v1/responses`. Tests prove that remote test URLs and test overrides outside test mode are rejected before brief-file access or network activity.

## Result

The run generated a six-slide draft with speaker notes, stable evidence references and `requires_human_review:true`. Structural validation passed. The review report remains `pending`; its warnings correctly disclose the AI draft and unverified synthetic evidence. An attempted PPTX build was rejected by the human-review gate and no PPTX was created.

The generated run report is `outputs/open-source-bakeoff/ai-plan-api-poc/api-test-report.json` and records hashes for the brief, evidence, synthetic response and generated storyboard. It omits the synthetic bearer-token value. The response fixture is explicitly hypothetical and makes no factual, experimental or performance claims.

The first end-to-end request uncovered a latent planner defect: `src/ai-plan.mjs` computed a `critique` object but serialized an undefined `critic` identifier into the review JSON. The writer now stores `critic: critique`; the end-to-end test verifies the review report is written. The three API tests cover successful request/response/draft validation, endpoint allowlisting, and prohibition of a test override outside test mode.

## Limits

- This proves protocol construction, JSON parsing, local validation, review artifacts and review gating. It does not prove model reasoning quality, current OpenAI model availability, hosted API authentication, provider-side schema enforcement, rate limits, cost, or real network behavior.
- A real provider run remains opt-in and requires the user's configured API key/account. Do not upload private research sources or call a paid endpoint without explicit authorization.
- Human approval is still necessary before rendering an approved PPTX; this API proof intentionally leaves the storyboard pending.
