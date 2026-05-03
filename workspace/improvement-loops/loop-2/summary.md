# Loop 2 Summary

## Changes Made

### Internal Code Quality (Agent 1)
1. **InputValidationError class** — typed error detection via `instanceof` instead of fragile substring matching
2. **Shared redactCredentials** — `src/redact.ts` replaces 4 copy-pasted redaction blocks
3. **In-flight request deduplication** — concurrent identical requests share one proxy call
4. **49 validators updated** — all throw InputValidationError

### Agent UX (Agent 2)
5. **Map description fixed** — "Crawl a URL" → "Scan a single page"
6. **CHAIN WITH hints** — 4 tools now tell agents what to chain with
7. **data.urls** — crawl and search responses include flat URL arrays
8. **quota.note removed** — ~15 tokens saved per response
9. **num → limit** — search param standardized (num kept as alias)
10. **PROXY4AGENT_* → NOVADA_PROXY_*** — env vars renamed with fallback

### Reviewer Fixes (Direct)
11. **Prompt/resource references** — num→limit in research_topic prompt and workflows resource
12. **InputValidationError test** — instanceof detection path now tested
13. **QUOTA_NOTE dead code** — removed from validation.ts
14. **Test fixture cleanup** — quota.note removed from crawl test

## Metrics
- Tests: 307 → 311 (+4)
- Build: clean
- New files: src/redact.ts
- Files modified: 18
