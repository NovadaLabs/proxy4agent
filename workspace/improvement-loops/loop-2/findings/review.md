# Loop 2 Code Review

## Summary: 5 issues found (0 critical, 2 high, 3 medium)

All 310 tests pass. No regressions detected in existing test suite.

---

## Change 1: InputValidationError class + classifyError instanceof check

**Status:** APPROVED

The `InputValidationError` class in `src/errors.ts` is correctly implemented:
- Extends `Error`, sets `this.name = "InputValidationError"` -- standard pattern.
- `classifyError` checks `err instanceof InputValidationError` at line 51 BEFORE the fallback substring matching at line 58. This means typed errors get classified cleanly, while untyped third-party errors still get caught by the phrase list. Correct priority ordering.
- The fallback phrase list is kept as a safety net -- good defensive design.

**Test coverage:** `classifyError.test.ts` tests INVALID_INPUT via substring matching (`"is required"`, `"must be"`) but does NOT test the `instanceof InputValidationError` path directly. This is a gap but not blocking since the behavior is identical.

**Issues:** None.

---

## Change 2: All validators throw InputValidationError instead of Error

**Status:** APPROVED

Verified all 7 validator functions now throw `InputValidationError`:
- `validateFetchParams` (fetch.ts)
- `validateBatchFetchParams` (batch.ts)
- `validateSearchParams` (search.ts)
- `validateSessionParams` (session.ts)
- `validateRenderParams` (render.ts)
- `validateExtractParams` (extract.ts)
- `validateMapParams` (map.ts)
- `validateCrawlParams` (crawl.ts)

All import `InputValidationError` from `"../errors.js"` -- correct ESM extension.

The inline validation in `agentproxyFetch` (line 92) and `agentproxyRender` (line 19) also throw `InputValidationError`. Consistent.

**Issues:** None.

---

## Change 3: `src/redact.ts` -- shared credential redaction function

**Status:** ISSUES FOUND (MEDIUM)

The function handles:
1. Adapter `sensitiveFields` (e.g. `pass`) -- both raw and URL-encoded.
2. The `user` field explicitly -- both raw and URL-encoded.
3. `NOVADA_API_KEY` and `NOVADA_BROWSER_WS` from env -- both raw and URL-encoded.

**Comparison with original copies:**
- `src/index.ts` error handler (line 343-354): Calls `redactCredentials()` when proxyContext exists, then falls back to manual API key redaction when no proxy context. This matches the old behavior.
- `src/cli.ts` `redactMessage()` (line 38-52): Same pattern -- delegates to `redactCredentials()` then falls back to manual. Correct.
- `src/tools/batch.ts` per-URL error handler (line 95): Calls `redactCredentials()` directly. Correct.

**Issue M1:** `redactCredentials` hardcodes `credentials["user"]` at line 16 for explicit user redaction. This works because ALL 5 adapters store the username under the key `"user"`:
- Novada: `user`, `pass`, `host`, `port`, `zone`
- BrightData: `user`, `pass`
- Smartproxy: `user`, `pass`
- Oxylabs: `user`, `pass`
- Generic: `proxyUrl`, `pass`

For GenericHttpAdapter, there IS no `"user"` key -- credentials are `{ proxyUrl, pass }`. The `user` field is `undefined`, so the block at line 16-19 is a no-op. Since GenericHttpAdapter's `sensitiveFields` includes `["pass", "proxyUrl"]`, the proxyUrl gets redacted via the sensitiveFields loop. The username is embedded inside proxyUrl, so it gets redacted implicitly. No actual bug, but the hardcoded `"user"` field name is fragile -- a future adapter could name it differently. Low risk since it's a defense-in-depth measure.

---

## Change 4: Shared redactCredentials usage in index.ts, cli.ts, batch.ts

**Status:** APPROVED

All three files import from `"./redact.js"` (or `"../redact.js"`) -- correct ESM extensions.

The fallback path in `index.ts` (lines 346-354) and `cli.ts` (lines 43-51) for when `proxyContext` is null still manually redacts `NOVADA_API_KEY` and `NOVADA_BROWSER_WS`. This is correct because `redactCredentials` requires an adapter + credentials, which aren't available when no proxy provider is configured.

**Issues:** None.

---

## Change 5: In-flight request deduplication in fetch.ts

**Status:** APPROVED

Implementation at lines 28, 118-141:
- `_inflightRequests` is a `Map<string, Promise<string>>`.
- Dedup is skipped when `cacheKey` is null (i.e., session_id is set or cache is disabled). Correct -- same reasoning as cache bypass.
- The inflight entry is cleaned up via `void fetchPromise.finally(() => { _inflightRequests.delete(cacheKey); }).catch(() => {})`. The `void` + `.catch()` prevents unhandled rejection from the derived `.finally()` promise. Correct pattern.
- Multiple callers with the same cacheKey will share the same promise. If the promise rejects, ALL piggybackers get the same rejection. This is correct behavior -- they would all have hit the same network error anyway.

**Edge case analysis:**
- If the first request succeeds and stores in cache, subsequent callers that started before the first completed will get the result from the shared promise (not cache). Cache will be populated for truly subsequent calls. Correct.
- If the first request fails, the inflight entry is cleaned up, and the next caller starts a fresh request. Correct.

**Test coverage:** No dedicated tests for inflight dedup. This is a gap but the feature is simple enough that the existing cache tests provide indirect coverage (the code path shares the same `_doFetch` function).

**Issues:** None.

---

## Change 6: Map description fix, CHAIN WITH hints, num->limit in search schema, NOVADA_PROXY_* env vars

**Status:** ISSUES FOUND (HIGH)

**6a. Map description:** Uses "Scan" -- correct per the requirement.

**6b. CHAIN WITH hints:** All 4 occurrences reference valid tool names:
- `agentproxy_search` CHAIN WITH `agentproxy_batch_fetch` -- correct.
- `agentproxy_extract` CHAIN WITH `agentproxy_fetch` -- correct.
- `agentproxy_map` CHAIN WITH `agentproxy_batch_fetch` -- correct.
- `agentproxy_crawl` CHAIN WITH `agentproxy_batch_fetch` -- correct.

**6c. num->limit in search schema:** The `inputSchema` in `index.ts` uses `limit` (not `num`). The `validateSearchParams` function accepts both `limit` and `num` (line 119: `raw.limit !== undefined ? Number(raw.limit) : (raw.num !== undefined ? Number(raw.num) : 10)`). The `SearchParams` interface still has `num?: number` as deprecated. Backward compat works.

**Issue H1 (HIGH): research_topic prompt still references `num=` instead of `limit=`.**
File: `src/index.ts`, line 486:
```
"1. Use agentproxy_search with query=\"${query}\", num=${numResults}, country=\"${country}\"..."
```
And line 671 (workflow resource):
```
"  agentproxy_search(query, num=5)"
```
Both should use `limit=` since `num` is deprecated. The `num` parameter still works as a backwards-compat alias, so this is not a functional bug, but it contradicts the schema which only exposes `limit`. An agent reading the schema would see `limit`, then seeing `num` in prompts would be confused.

**6d. NOVADA_PROXY_* env vars:** The rename is correctly implemented with fallbacks:
- `NOVADA_PROXY_CACHE_TTL ?? PROXY4AGENT_CACHE_TTL_SECONDS` (fetch.ts:32)
- `NOVADA_PROXY_MAX_RENDERS ?? PROXY4AGENT_MAX_RENDERS` (index.ts:50)

Both use `??` (nullish coalescing) which is correct -- `undefined` from a missing env var falls through to the legacy name. If BOTH are set, the new name wins. Correct.

---

## Change 7: data.urls convenience field in crawl.ts

**Status:** APPROVED

Line 307: `urls: pages.map(p => p.url)` -- creates a flat array of all crawled URLs for easy consumption by agents that want to pass URLs directly to `agentproxy_batch_fetch`. The field is derived from `pages` which already exists, so it's always consistent.

**Issues:** None.

---

## Change 8: data.urls field + limit param in search.ts

**Status:** APPROVED

Line 98: `urls: results.map((r: { url: string }) => r.url)` -- same pattern as crawl.ts. Flat array of result URLs for easy chaining.

The `limit` parameter is used as the primary name, with `num` as a deprecated alias. The `SearchParams` interface declares both. `agentproxySearch` reads `params.limit ?? params.num ?? 10` (line 22). Correct backward compat.

**Issues:** None.

---

## Change 9: meta.quota.note removed from responses

**Status:** ISSUES FOUND (MEDIUM)

**Grep results:** `QUOTA_NOTE` is still exported from `src/validation.ts` (line 7) but is not imported anywhere in the source code. It's dead code.

**Issue M2 (MEDIUM): `QUOTA_NOTE` is dead code in `src/validation.ts`.**
The constant is still exported but never used. Should be removed to avoid confusion.

**Issue M3 (MEDIUM): Test fixture still includes `quota.note` field.**
File: `src/__tests__/crawl.test.ts`, line 160:
```typescript
quota: { credits_estimated: 1, note: "" },
```
The `makeFetchResponse` helper in the crawl test creates mock responses with `quota.note`. This doesn't cause test failures because the code never reads `quota.note` from fetched responses -- it only constructs new `quota` objects in the output. But it's misleading in the test fixture and should be cleaned up.

**Overall assessment:** The `quota.note` field has been successfully removed from ALL production response paths. The `QuotaMeta` type in `types.ts` still has `note?: string` marked as deprecated (line 14: `note?: string; // deprecated -- no longer included in responses`). This is fine for backward compat -- consumers that check for `note` won't break.

---

## Change 10: PROXY4AGENT_* -> NOVADA_PROXY_* env var rename with fallback

**Status:** APPROVED

Covered in Change 6d above. Both env var references use `??` fallback correctly. The test file `cache.test.ts` has comprehensive tests for the fallback behavior (lines 67-114), including:
- Default (neither set) returns 300
- Legacy only returns its value
- New name takes precedence over legacy
- 0 disables cache
- Invalid values fall back to default
- Negative values fall back to default

**Issues:** None.

---

## Deep Check Results

### DC1: Does redactCredentials handle ALL cases?
Yes. See Change 3 analysis. The shared function covers sensitiveFields + user + API env vars. Each call site (index.ts, cli.ts, batch.ts) has the correct fallback for when proxyContext is null.

### DC2: Is the inflight dedup map cleaned up on ALL error paths?
Yes. The `.finally()` handler at line 136 runs on both success and failure. The `void + .catch()` pattern prevents the derived promise from causing unhandled rejections. See Change 5 analysis.

### DC3: Does limit/num backward compat work?
Yes. `validateSearchParams` accepts both, prefers `limit`. `agentproxySearch` reads `params.limit ?? params.num ?? 10`. Tests confirm both paths work (validators.test.ts lines 204-210).

### DC4: Are env var fallbacks correct?
Yes. `NOVADA_PROXY_CACHE_TTL ?? PROXY4AGENT_CACHE_TTL_SECONDS ?? 300` -- note the default 300 is applied via the `Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_CACHE_TTL_SECONDS` guard, not a third `??`. Functionally equivalent. `NOVADA_PROXY_MAX_RENDERS ?? PROXY4AGENT_MAX_RENDERS` with guard `Number.isInteger(raw) && raw > 0 && raw <= 20 ? raw : 3`. Correct.

### DC5: Is QUOTA_NOTE removed from ALL response paths?
Yes. Grep confirms `QUOTA_NOTE` is only in `src/validation.ts` as an unused export, and `quota.note` only appears in test fixtures. No production code includes `note` in quota objects.

### DC6: Do CHAIN WITH hints reference correct tool names?
Yes. All 4 CHAIN WITH hints reference valid tool names that exist in the TOOLS array. See Change 6b.

### DC7: Does data.urls contain the right URLs?
Yes.
- `crawl.ts` line 307: `pages.map(p => p.url)` -- all crawled page URLs.
- `search.ts` line 98: `results.map((r: { url: string }) => r.url)` -- all search result URLs.
Both are correct and derived from the primary data arrays.

---

## Verdict: NEEDS_FIX (minor)

All changes are functionally correct and backward-compatible. No critical issues. The 2 high issues and 3 medium issues are quality/consistency items that should be addressed:

## Issues to Fix

### H1 (HIGH): Prompts and workflow resource still reference deprecated `num` parameter
- **File:** `src/index.ts`, line 486 -- research_topic prompt uses `num=${numResults}` instead of `limit=${numResults}`
- **File:** `src/index.ts`, line 671 -- workflows resource uses `agentproxy_search(query, num=5)` instead of `limit=5`
- **Impact:** Agents reading the schema see `limit`, but prompts say `num` -- inconsistency.
- **Fix:** Replace `num=` with `limit=` in both locations.

### H2 (HIGH): No test for InputValidationError instanceof path in classifyError
- **File:** `src/__tests__/classifyError.test.ts`
- **Impact:** The `instanceof InputValidationError` detection path (errors.ts:51) is untested. Current tests only cover the substring fallback.
- **Fix:** Add a test: `classifyError(new InputValidationError("bad param"))` should return `INVALID_INPUT`.

### M1 (MEDIUM): redactCredentials hardcodes "user" field name
- **File:** `src/redact.ts`, line 16
- **Impact:** Fragile if a future adapter uses a different key for username. Low risk currently since all adapters either use "user" or don't have one.
- **Fix:** Consider reading from a constant or adapter method. Or accept the fragility as acceptable for now.

### M2 (MEDIUM): QUOTA_NOTE is dead code
- **File:** `src/validation.ts`, line 7
- **Impact:** No functional impact, but dead exports confuse maintainers.
- **Fix:** Remove the export. If needed for backward compat by downstream consumers, keep it with a deprecation comment.

### M3 (MEDIUM): Test fixture includes deprecated quota.note field
- **File:** `src/__tests__/crawl.test.ts`, line 160
- **Impact:** Misleading test fixture. No functional impact since the code under test doesn't read this field.
- **Fix:** Remove `note: ""` from `makeFetchResponse` helper.
