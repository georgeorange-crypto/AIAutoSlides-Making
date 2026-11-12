# Phase 2 runtime and robots.txt acceptance

Status: **runtime installed; one-page live crawl and robots allow/deny checks passed; phase acceptance complete for the single-page crawler slice.**

## Runtime installation

- Installed the isolated research runtime with `workers/research/install.ps1` in the original checkout. It uses Python 3.12, the pinned `workers/research/requirements-lock.txt`, and the matching Playwright Chromium browser. The environment is under that checkout's `.venv/research`; it is local and is not committed.
- The configured package mirror twice ended a large download with `IncompleteRead`; retrying the same pinned installation against `https://pypi.org/simple` completed. No index configuration was persisted.
- The phase worktree uses that installed runtime via `AIAUTOSLIDES_PYTHON`. `npm ci` completed in the phase worktree.
- `npm run research:ingest -- doctor` reported Python **3.12.7**, Docling **2.150.0**, and Crawl4AI **0.9.5**. The matching Playwright Chromium browser was installed and verified with Playwright's browser inventory.

## Change made

Crawl4AI 0.9.5's internal robots fetch can treat a blocked/error response as permission to proceed. The crawler now performs a separate robots preflight before starting a browser:

- It requests same-origin `/robots.txt` with a transparent project User-Agent, no redirects, a 15-second total timeout, and a 512 KiB response cap.
- HTTP 200 is parsed with Python's `RobotFileParser`; an explicit deny stops the crawl. HTTP 404/410 means no policy file. Redirects, other statuses (including 401/403), network errors, oversized content, and invalid UTF-8 fail closed.
- The same User-Agent is passed to Crawl4AI's browser, while its built-in robots check remains enabled.
- A unit test exercises a robots-allowed article path and a disallowed `/w/` path; the Node test asserts the updated Python test count.

## Acceptance evidence

- `npm run research:ingest -- crawl --url https://en.wikipedia.org/wiki/Robots_exclusion_standard --site-authorized --allow-network --out-dir outputs/m12-robots-acceptance/allowed --timeout 45` succeeded. It wrote a one-page evidence bundle; `source.manifest.json` records `robots_checked: true`, and excerpts remain `pending_human_review` / unverified.
- The same command for `https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&format=json` exited **1** with `robots.txt disallows this URL; refusing to crawl`. The designated output directory was absent afterward, so the disallowed page was not fetched and no evidence artifact was emitted.
- The live environment maps public DNS through `198.18.0.0/15`; the two live checks explicitly set `AIAUTOSLIDES_EGRESS_CIDRS=198.18.0.0/15` to allow this documented outbound gateway. This setting was process-local and not committed.
- `npm run test`: **157 passed, 0 failed**. This includes the Python policy suite (4 tests).
- `npm run check`: passed end to end, including dependency inspection, all 157 tests, critic evaluation, synthetic CSV/benchmark workflows, all demo builds and QA, dual-deck build, and critique generation.
- `npm run validate`: passed, **7 slides**, with 3 existing warnings (missing chart sample size and two unverified evidence items).
- `node src/cli.mjs build --input examples/research-demo.json --out outputs/m12-acceptance/research-demo.pptx`: passed, **7 slides**.
- `node scripts/preview.mjs outputs/m12-acceptance/research-demo.pptx`: PowerPoint 16.0 + Poppler rendered **7 pages**. All seven page images were visually inspected; no new cropping or text overlap was observed.

## Remaining boundary

This acceptance verifies the installed local runtime and one explicitly authorized public origin. It does not certify all site-specific robots dialects or site terms. DNS validation and browser connection remain separate operations, so DNS rebinding cannot be ruled out in-process; deployments exposed to untrusted callers must also enforce outbound public-only network policy at the OS/container layer. Crawled text remains untrusted and requires human source and rights review.
