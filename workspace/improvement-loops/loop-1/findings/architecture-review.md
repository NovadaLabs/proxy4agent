# Architecture Review -- novada-proxy-mcp v1.8.1

## Summary Score: 7.8/10

Solid, well-structured MCP server with a clean adapter pattern and excellent agent-first error design. The main structural problems are a monolithic index.ts, pervasive credential redaction duplication, validation copy-paste across tools, and a cache implementation that lacks thread safety for concurrent access patterns. No security showstoppers, but several MEDIUM issues worth fixing.

---

## 1. Code Structure & Organization

**Score:** 7/10

**Good:**
- Clear separation: `adapters/`, `tools/`, config, types, errors, utils, validation -- each has a well-defined purpose.
- Adapter pattern isolated in its own directory with a clean interface (`src/adapters/types.ts:1-69`).
- Tools are split into individual files per capability (`src/tools/fetch.ts`, `search.ts`, etc.) with a barrel re-export (`src/tools/index.ts`).

**Issues:**
- [HIGH] `src/index.ts:1-890` -- 890-line monolith. MCP server class, tool definitions (static JSON schemas), prompt definitions, resource definitions, CLI argument parsing, and startup logic are all in one file. The `TOOLS` array alone is 200 lines of JSON schema. This file mixes four concerns: (1) MCP registration, (2) tool schema definitions, (3) prompt/resource content, (4) CLI entrypoint.
- [MEDIUM] `src/cli.ts:1-684` -- 684-line file that duplicates much of the same tool-dispatch logic as `index.ts`. The switch/case dispatch pattern is duplicated between the two files. Adding a tool requires changes in both.
- [LOW] `src/validation.ts:1-8` -- This file is just 3 regex constants and 1 string constant. It's imported by every tool but doesn't contain any validation functions. The actual validation functions live in each tool file. The naming is misleading -- `constants.ts` would be more accurate.

**Recommendation:** Extract `TOOLS` array into `src/tools/schemas.ts`. Extract prompts and resources into `src/prompts.ts` and `src/resources.ts`. Create a shared `toolDispatcher` function used by both `index.ts` and `cli.ts` to eliminate the duplicated switch/case.

---

## 2. Adapter Pattern

**Score:** 9/10

**Good:**
- `ProxyAdapter` interface (`src/adapters/types.ts:28-69`) is clean and well-documented. Every field has JSDoc. The contract is minimal: `name`, `displayName`, `capabilities`, `sensitiveFields`, `loadCredentials()`, `buildProxyUrl()`.
- Priority-ordered resolution (`src/adapters/index.ts:21-27`) is simple and predictable. Novada first, Generic last.
- `loadCredentials` returns `null` instead of throwing -- fail-open design that lets the resolver try the next adapter.
- `sensitiveFields` declaration enables systematic redaction at the call site -- adapters declare what's sensitive, callers redact.
- Each adapter is a stateless object literal (not a class), which is appropriate since they carry no mutable state.

**Issues:**
- [LOW] `src/adapters/types.ts:10` -- `ProxyCredentials` uses `[key: string]: string` (index signature). This is maximally loose -- any adapter can put any key. There's no compile-time enforcement that `NovadaAdapter.loadCredentials()` returns credentials that `NovadaAdapter.buildProxyUrl()` actually uses. The typing is correct at runtime but offers zero static safety. A generic like `ProxyAdapter<TCredentials>` would give callers type safety on the credentials shape.
- [LOW] `src/adapters/novada.ts:53`, `brightdata.ts:51`, etc. -- All five adapter `buildProxyUrl` implementations follow the same pattern (string concatenation + `encodeURIComponent`), but there's no shared helper. Minor duplication, but not worth abstracting unless more adapters are added.

**Recommendation:** The adapter pattern is the strongest part of the architecture. The `ProxyCredentials` looseness is a deliberate trade-off for simplicity and is acceptable at this scale (5 adapters). No action needed unless adapter count grows significantly.

---

## 3. Error Handling

**Score:** 8/10

**Good:**
- `classifyError` (`src/errors.ts:4-54`) is a single, testable error classifier. Every error path produces a structured `ProxyErrorResponse` with `code`, `message`, `recoverable`, `agent_instruction`, and optional `retry_after_seconds`.
- `agent_instruction` field in every error response is excellent agent-first design -- the LLM knows exactly what to do next.
- Error classification priority is well-ordered: 429 > 4xx > timeout > DNS > TLS > provider > input > unknown.
- Credential redaction in error messages is systematic (`src/index.ts:341-365`) -- iterates over `sensitiveFields` and also redacts encoded forms.

**Issues:**
- [HIGH] `src/index.ts:341-365`, `src/index.ts:865-887`, `src/cli.ts:37-62`, `src/tools/batch.ts:92-102` -- Credential redaction logic is copy-pasted **four times** across the codebase. Each copy follows the same pattern: iterate `sensitiveFields`, replace raw + encoded values, also redact `user` and `NOVADA_API_KEY`/`NOVADA_BROWSER_WS`. If one copy is updated (e.g., a new credential type), the others will be missed.
- [MEDIUM] `src/errors.ts:43-48` -- `INVALID_INPUT` detection uses string matching against a list of phrases (`"is required"`, `"must be"`, `"must start with"`, etc.). This is fragile -- if a future validation message doesn't contain one of these phrases, it falls through to `UNKNOWN_ERROR`. The validation functions should throw a typed error (e.g., `InputValidationError`) instead of relying on message substring matching.
- [LOW] `src/errors.ts:5-6` -- The Axios error check uses `axios.isAxiosError(err)` then immediately casts `(err as AxiosError)`. This is correct but the double-cast is unnecessary since `isAxiosError` is a type guard.

**Recommendation:** Extract credential redaction into a shared `redactCredentials(message, context)` function. Replace string-based `INVALID_INPUT` detection with a typed `InputValidationError` class.

---

## 4. Caching

**Score:** 7/10

**Good:**
- Cache is keyed by `url|format|country` (`src/tools/fetch.ts:36`) -- covers the dimensions that affect response content.
- Session-pinned requests bypass cache (`src/tools/fetch.ts:97`) -- correct semantics since sessions imply IP-specific routing.
- LRU-like eviction: on cache hit, entry is deleted and re-inserted to refresh position (`src/tools/fetch.ts:105-106`).
- TTL is configurable via `PROXY4AGENT_CACHE_TTL_SECONDS`, disable with `0`.
- Max entries capped at 200 (`src/tools/fetch.ts:18`), with prune-then-evict strategy.

**Issues:**
- [MEDIUM] `src/tools/fetch.ts:26` -- `_responseCache` is a module-level `Map<string, CacheEntry>` with no concurrency protection. Node.js is single-threaded for sync code, but `agentproxyFetch` is async. Two concurrent requests for the same uncached URL will both pass the cache-miss check (line 102-103), both make network calls, and both write to the cache. This is wasted proxy credits, not data corruption, but it violates the stated goal of "eliminates duplicate proxy credits."
- [MEDIUM] `src/tools/fetch.ts:198-209` -- Cache stores the full serialized JSON response including content. For a 100KB truncated page, that's 100KB per cache entry. With `MAX_CACHE_ENTRIES = 200`, theoretical max is 20MB of cached HTML strings. There's no byte-size limit on total cache memory. In practice, 20MB is fine for a proxy tool, but the absence of a byte limit means a batch of 200 large pages could cause significant memory pressure.
- [LOW] `src/tools/fetch.ts:49` -- `evictOldest` uses `Map.keys().next().value` which relies on Map insertion order. This works but the comment says "oldest insertion" while the LRU refresh (line 105-106) means it actually evicts the least-recently-used entry. The implementation is correct but the comment is misleading.
- [LOW] `src/tools/fetch.ts:107-111` -- Cache hit path deserializes JSON on every hit (`JSON.parse(hit.payload)`) and then mutates the parsed object to set `cache_hit`, `cache_age_seconds`, and `latency_ms` before re-serializing. This means the original cached payload is never mutated (good), but the parse/serialize overhead on every hit is unnecessary -- the cache could store the object directly and produce the response with spread.

**Recommendation:** Add a deduplication mechanism for in-flight requests (a `Map<string, Promise<string>>` of pending fetches). Consider storing parsed objects in cache instead of serialized strings to avoid parse overhead on hits.

---

## 5. Type Safety

**Score:** 8/10

**Good:**
- `tsconfig.json` has `"strict": true` -- full strict mode enabled.
- Zero `as any` in production code (only in test mocks).
- `ProxyErrorCode` is a string literal union type (`src/types.ts:1-10`), not a plain string.
- `ProxyResponse` discriminated union (`src/types.ts:46`) with `ok: true | false` enables type narrowing.
- Validator functions return typed params objects (`FetchParams`, `SearchParams`, etc.) -- no untyped objects flow past validation.

**Issues:**
- [MEDIUM] `src/tools/batch.ts:138` and `src/tools/crawl.ts:305` -- `results as unknown as Record<string, unknown>[]` and `pages as unknown as Record<string, unknown>[]`. These double-cast through `unknown` to force `BatchFetchResult[]` and `CrawlPageResult[]` into the `Record<string, unknown>` shape required by `ProxySuccessResponse.data`. This works but circumvents type checking. The root cause is that `ProxySuccessResponse.data` is typed as `Record<string, unknown>`, which is too loose. Using `data: unknown` or a generic `ProxySuccessResponse<T>` would be cleaner.
- [MEDIUM] `src/tools/fetch.ts:156-158` -- `response.headers["content-encoding"] as string | undefined` and `response.headers["content-type"] as string | undefined`. Axios headers typing allows `string | string[]` for header values. The cast to `string | undefined` silently drops the array case. While multi-value `content-encoding` is extremely rare, the correct approach would be to handle it or at least take the first element.
- [LOW] `src/adapters/types.ts:10` -- `ProxyCredentials` is `[key: string]: string`. As noted in section 2, this sacrifices static type checking for flexibility.

**Recommendation:** Make `ProxySuccessResponse` generic: `ProxySuccessResponse<T = Record<string, unknown>>` with `data: T`. This eliminates the double-cast in batch and crawl.

---

## 6. Extensibility

**Score:** 8/10

**Good:**
- Adding a new **provider**: create `src/adapters/<name>.ts`, implement `ProxyAdapter`, add to the array in `src/adapters/index.ts`. No other changes needed. This is documented in `src/adapters/index.ts:17-19` and `src/adapters/types.ts:1-6`.
- Adding a new **tool**: create `src/tools/<name>.ts` with handler + validator, export from `src/tools/index.ts`, add schema to `TOOLS` array in `src/index.ts`, add case to switch in `index.ts`, add case to switch in `cli.ts`. Documented in practice but not explicitly.

**Issues:**
- [HIGH] Adding a tool requires changes in **four places**: (1) `src/tools/<name>.ts`, (2) `src/tools/index.ts`, (3) `src/index.ts` TOOLS array + switch case, (4) `src/cli.ts` switch case + CLI args. This is a 4-file edit for what should be a 2-file edit (implementation + registration). The duplicated dispatch in `index.ts` and `cli.ts` is the root cause.
- [MEDIUM] Tool input schemas are defined as raw JSON objects in `src/index.ts:60-204` rather than derived from TypeScript types. The schemas and the validator functions (`validateFetchParams`, etc.) must be kept in sync manually. There's no mechanism to detect drift between the schema and the validator.

**Recommendation:** Create a `ToolDefinition` type that pairs the schema with its handler and validator. Register tools in a single registry. Both `index.ts` and `cli.ts` iterate the registry instead of maintaining separate switch statements.

---

## 7. Naming Consistency

**Score:** 6/10

**Good:**
- Internal tool names are consistently `agentproxy_*` (underscore, not hyphen) across all files.
- Adapter names are consistently `snake_case` lowercase.
- Config constants are `UPPER_SNAKE_CASE`.

**Issues:**
- [HIGH] **Four different names for the same product:**
  - npm package: `novada-proxy-mcp` (`package.json:2`)
  - GitHub repo: `proxy4agent` (`package.json:77`)
  - Tool prefix: `agentproxy_*` (every tool)
  - README title: "Novada Proxy" (`README.md:1`)
  - Config constant: `NPM_PACKAGE = "novada-proxy-mcp"` (`src/config.ts:3`)
  - Env var prefix: `PROXY4AGENT_*` for cache config (`src/tools/fetch.ts:31`)
  - Env var prefix: `NOVADA_*` for credentials (`src/index.ts:41-42`)
  - LobeHub badge: `novadalabs-proxy4agent` (`README.md:26`)
  
  An agent encountering this codebase sees: `agentproxy_fetch` (tool name), `novada-proxy-mcp` (package name), `proxy4agent` (repo URL), `PROXY4AGENT_CACHE_TTL_SECONDS` (env var), and `NOVADA_PROXY_USER` (env var). These are five different naming conventions for the same product.

- [MEDIUM] `src/tools/fetch.ts:122` -- Console warning uses `[novada-proxy]` prefix, but the tool names use `agentproxy_*` prefix. An agent parsing stderr would see inconsistent prefixes.
- [LOW] `package.json:4` -- `"mcpName": "io.github.NovadaLabs/novada-proxy-mcp"` but the repo URL is `proxy4agent.git`. The mcpName and repo name disagree.

**Recommendation:** This is a known legacy issue. At minimum, unify the env var prefix -- `PROXY4AGENT_CACHE_TTL_SECONDS` should be `NOVADA_CACHE_TTL_SECONDS` to match the other env vars. Document the naming history somewhere agents won't trip over it.

---

## 8. Security

**Score:** 8/10

**Good:**
- Injection prevention via `SAFE_COUNTRY`, `SAFE_CITY`, `SAFE_SESSION_ID` regexes (`src/validation.ts:3-5`) -- no hyphens allowed, which prevents username-injection attacks where proxy providers use `-` as segment delimiters.
- Credential redaction in all error paths -- `sensitiveFields` + explicit `user` + `NOVADA_API_KEY` + `NOVADA_BROWSER_WS` all redacted before surfacing to agents.
- CSS selector allowlist for `wait_for` in render (`src/tools/render.ts:107`) -- prevents backticks, semicolons, braces.
- `data:` and `javascript:` URIs stripped from markdown links (`src/utils.ts:35`).
- API key in search URL is sanitized from all error messages (`src/tools/search.ts:56-58`).
- `maxContentLength: 50 * 1024 * 1024` (`src/tools/fetch.ts:151`) prevents unbounded memory from large responses.

**Issues:**
- [MEDIUM] `src/tools/search.ts:30-40` -- Novada Search API authenticates via query parameter (`api_key`). This means the API key appears in server access logs, proxy logs, and any intermediate HTTP proxy. The code has a comment acknowledging this (`search.ts:28-30`) but does not attempt header-based auth as a mitigation. If the API supports it, using `Authorization: Bearer` would be more secure.
- [MEDIUM] `src/tools/render.ts:26` -- Puppeteer connects via `browserWSEndpoint` which is a WebSocket URL containing credentials. If this connection fails and the error message includes the URL, the credentials would be in the error. The outer redaction in `index.ts` handles this, but the render tool itself doesn't redact -- if someone calls `agentproxyRender` directly (as a library), errors could leak the WS URL.
- [LOW] `src/tools/fetch.ts:151` -- `maxContentLength: 50 * 1024 * 1024` is 50MB. This is generous. A malicious URL could force the server to allocate 50MB of memory per request. With concurrent batch fetches (up to 5 concurrent * 20 URLs), this could reach 1GB theoretically. In practice, the 100K truncation happens after decompression, but the full 50MB is downloaded and decompressed first.

**Recommendation:** Investigate header-based auth for the search API. Add redaction of `browserWsEndpoint` in the render tool itself, not just in the caller.

---

## 9. Dependencies

**Score:** 9/10

**Good:**
- Only 5 production dependencies, all justified:
  - `@modelcontextprotocol/sdk` -- MCP protocol (core requirement)
  - `axios` -- HTTP client (core requirement)
  - `http-proxy-agent` / `https-proxy-agent` -- proxy tunneling (core requirement)
  - `puppeteer-core` -- browser rendering (core requirement for render tool)
- 3 dev dependencies: `@types/node`, `typescript`, `vitest`. Minimal.
- `puppeteer-core` (not `puppeteer`) -- does not bundle Chromium, requires external browser. Correct choice for a tool that connects to a remote browser API.

**Issues:**
- [LOW] `package.json:88` -- `puppeteer-core: ^22.15.0`. This is a significant dependency (large sub-dependency tree) but is only used by the render tool. If render is not configured (`NOVADA_BROWSER_WS` not set), it's dead weight. However, making it optional via dynamic `import()` would add complexity that isn't worth it at this scale.
- [LOW] `node_modules/` is 124MB with 212 top-level directories (264 total packages from lockfile). This is moderately heavy but most comes from puppeteer-core's dependency chain. For a CLI tool distributed via `npx`, this is acceptable.

**Recommendation:** No action needed. Dependencies are minimal and justified. The puppeteer-core weight is an inherent cost of offering browser rendering.

---

## 10. Test Coverage

**Score:** 8/10

**Good:**
- 307 tests, all passing in 1.77s. Fast feedback loop.
- 11 test files covering: adapters, cache, classifyError, CLI, crawl, extract, extractHelpers, MCP contracts, rate limiting, utils, validators.
- Tests are well-structured: each test file has clear describe/it blocks with descriptive names.
- Cache behavior is extensively tested: hit/miss, session bypass, TTL disable, country/format independence, retry logic, truncation.
- Validator tests cover all happy paths and edge cases including injection prevention.
- Crawl tests use mocked `agentproxyFetch` for isolated BFS testing.
- CLI tests run the actual built binary and verify JSON output format.

**Issues:**
- [HIGH] No tests for `agentproxyMap`, `agentproxySearch`, `agentproxySession`, or `agentproxyRender` handler logic. Only their validators are tested. The handler functions contain significant logic (URL resolution in map, result normalization in search, sticky verification in session) that is untested. The extract handler is also untested (only `extractField` and `shouldEscalateToRender` helpers are tested).
- [MEDIUM] No tests for the prompt handler logic (`src/index.ts:469-560`). Prompts are registered and served but never verified in tests. A broken prompt template (e.g., wrong field interpolation) would not be caught.
- [MEDIUM] No tests for the resource handler logic (`src/index.ts:603-783`). Resource URIs and their content are never verified.
- [LOW] `src/__tests__/ratelimit.test.ts` -- Tests a `createLimiter` helper that is NOT the actual limiter used in `index.ts`. The test re-implements the pattern to verify the pattern works, but doesn't test the actual code path. If someone changes the limiter in `index.ts`, these tests would still pass.

**Recommendation:** Add integration tests for `agentproxyMap`, `agentproxySearch`, `agentproxySession`, and `agentproxyRender` using mocked HTTP/Puppeteer. Add snapshot tests for prompt and resource content to detect accidental changes.

---

## Top 5 Priority Fixes

1. **[HIGH] Extract credential redaction into a shared function** -- Currently copy-pasted 4 times across `src/index.ts` (twice), `src/cli.ts`, and `src/tools/batch.ts`. A new credential type or a bug fix would need to be applied in all four locations. Create `src/redact.ts` with a single `redactCredentials(message: string, sensitiveValues: string[]): string` function. Estimated effort: 30 minutes. Files: `src/index.ts:341-365`, `src/index.ts:865-887`, `src/cli.ts:37-62`, `src/tools/batch.ts:92-102`.

2. **[HIGH] Deduplicate tool dispatch between index.ts and cli.ts** -- Adding a tool requires editing 4 files (tool, barrel, index.ts, cli.ts). Create a shared tool registry (`src/tools/registry.ts`) that maps tool name to `{ schema, validator, handler }`. Both `index.ts` and `cli.ts` iterate the registry instead of maintaining independent switch statements. Estimated effort: 2 hours. Files: `src/index.ts:234-335`, `src/cli.ts:113-500`.

3. **[HIGH] Add handler-level tests for map, search, session, render** -- These tools have zero handler-level test coverage. Map's URL resolution logic, search's result normalization, session's sticky verification, and render's Puppeteer lifecycle are all tested only implicitly through the CLI tests (which don't exercise these handlers). Estimated effort: 3 hours. Files: new test files needed.

4. **[MEDIUM] Add in-flight request deduplication to cache** -- Two concurrent requests for the same uncached URL both make network calls and both pay proxy credits. Add a `Map<string, Promise<string>>` of in-flight requests. Before making a network call, check if another request for the same cache key is already in flight; if so, await the existing promise. Estimated effort: 1 hour. File: `src/tools/fetch.ts:82-233`.

5. **[MEDIUM] Replace string-matching INVALID_INPUT detection with typed errors** -- `classifyError` uses substring matching (`"is required"`, `"must be"`, etc.) to detect validation errors. This is fragile. Create an `InputValidationError extends Error` class, use it in all validators, and detect it via `instanceof` in `classifyError`. Estimated effort: 1 hour. Files: `src/errors.ts:43-48`, all `validate*` functions.
