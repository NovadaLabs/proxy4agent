# Loop 3 Re-Audit -- novada-proxy-mcp v1.8.1

## Overall Score: 8.6/10

All 311 tests pass. 11 test files covering validators, error classification, caching, adapters, extract helpers, crawl integration, CLI, MCP contracts, utils, and rate limiting. The codebase is well-structured, has strong agent UX, and demonstrates care in security-sensitive areas (credential redaction, injection prevention). Issues found are minor-to-medium; nothing is broken.

---

## 1. Code Structure & Organization (9/10)

Clean module boundaries: adapters/, tools/, and core files (types, errors, redact, validation, utils, config) are well separated. Each tool handler lives in its own file with co-located validator and types. The adapter pattern (interface + registry + priority resolution) is extensible and well-documented.

**Issues:**

- [LOW] src/index.ts:60-206 -- The TOOLS array (150 lines of tool definitions) is inlined in the main server file. This makes index.ts 859 lines. The tool definitions could be co-located with their handlers (each tool file already exports types and validators). Not blocking, but it makes index.ts harder to scan.
- [LOW] src/tools/crawl.ts:96-137 -- `mapWithConcurrency` duplicates the semaphore pattern from src/tools/batch.ts:48-65. Both implement acquire/release with queue. Could be extracted to a shared `concurrency.ts` utility, but the duplication is small (~20 lines each) and self-contained.
- [LOW] src/index.ts:802-848 and src/cli.ts -- Help text and CLI handling are split between index.ts (--help, --list-tools for the MCP binary) and cli.ts (full CLI). The index.ts CLI section at the bottom (lines 802-859) mixes server bootstrap with CLI argument handling. This is minor since both entry points are clearly separate binaries.

**Recommendation:** Consider extracting the TOOLS array to a `src/tools/definitions.ts` file. The concurrency utility could be shared but is low priority given the small size.

---

## 2. Error Handling & Type Safety (9/10)

TypeScript strict mode is enabled. Error classification is thorough with 9 typed error codes, each with `agent_instruction` guidance. The `InputValidationError` class provides clean instanceof detection. Fallback substring matching (line 57-62 in errors.ts) catches errors from third-party code that match known patterns.

**Issues:**

- [LOW] src/errors.ts:57 -- The INPUT_ERROR_PHRASES fallback uses substring matching on error messages. This could theoretically misclassify a third-party error containing "must be" as INVALID_INPUT. The instanceof check (line 51) is the primary path, so this is a defense-in-depth concern only.
- [LOW] src/tools/batch.ts:129 -- `results as unknown as Record<string, unknown>[]` is a double cast to satisfy the `ProxySuccessResponse.data` type. The data field is typed as `Record<string, unknown>` which is correct for the MCP protocol's JSON output, but this cast obscures the actual BatchFetchResult[] type at the point of assignment.
- [LOW] src/tools/crawl.ts:306 -- Same pattern: `pages as unknown as Record<string, unknown>[]`.
- [INFO] No `as any` in production code -- only in test mocks (classifyError.test.ts, cache.test.ts) for AxiosError construction. This is acceptable.

**Recommendation:** The double casts in batch.ts:129 and crawl.ts:306 could be avoided by widening `ProxySuccessResponse.data` to allow arrays, or by using a generic response type. Low priority since the serialized JSON output is correct.

---

## 3. Naming Consistency (7.5/10)

This is the weakest area. There is a naming layer mismatch between the product name, the tool prefix, and the repository context.

**Issues:**

- [MEDIUM] Throughout -- Product is `novada-proxy-mcp` (package.json, config.ts), but all tool names use the `agentproxy_` prefix (e.g., `agentproxy_fetch`, `agentproxy_render`). Function names also use `agentproxy*` (e.g., `agentproxyFetch`). The GitHub repo URL references `proxy4agent`. This creates three naming layers: novada-proxy-mcp (npm), agentproxy_* (tools/functions), proxy4agent (repo URL). An agent sees `agentproxy_fetch` but the package is `novada-proxy-mcp` -- no confusion in practice since agents interact with tool names, but the internal naming is inconsistent with the product identity.
- [LOW] src/tools/fetch.ts:32 and src/index.ts:50 -- Legacy env var fallbacks (`PROXY4AGENT_CACHE_TTL_SECONDS`, `PROXY4AGENT_MAX_RENDERS`) are maintained alongside `NOVADA_PROXY_*` equivalents. This is backwards-compat and correctly documented, but adds surface area.
- [LOW] src/index.ts:612 -- The countries resource lists "tokyo" twice under Asia cities. This is a data error, not a naming issue.

**Recommendation:** The tool prefix `agentproxy_` is embedded in every LLM's context that uses this server. Renaming tools is a breaking change for all agents. The mismatch is cosmetic but worth documenting in CLAUDE.md or README so contributors understand the layered naming. The "tokyo" duplicate should be fixed.

---

## 4. Agent UX (9.5/10)

This is a standout area. Tool descriptions are detailed with WHEN TO USE, USE X INSTEAD, ON FAILURE, and CHAIN WITH guidance. Every error response includes `agent_instruction` with concrete next steps. Response format is consistent across all 9 tools: `{ ok, tool, data, meta }` for success, `{ ok: false, error: { code, message, recoverable, agent_instruction } }` for failure. Cache metadata (`cache_hit`, `cache_age_seconds`) and cost metadata (`credits_estimated`) are included in every response.

**Issues:**

- [LOW] src/index.ts:148 -- `agentproxy_session` description says "Use verify_sticky:true to confirm the session held" but also says "verify_sticky:true makes 3 sequential proxy calls and adds ~15-25 seconds." The description is accurate but lengthy (9 lines). Some agents may truncate long descriptions.
- [LOW] src/index.ts:98-109 -- `agentproxy_render` format enum is `["markdown", "html", "text"]` but `agentproxy_fetch` format enum is `["markdown", "raw"]`. The asymmetry is intentional (render returns HTML by default, fetch returns bytes) but could confuse an agent that expects uniform format options across tools.
- [INFO] Resources (proxy://countries, proxy://error-codes, proxy://workflows, proxy://supported-fields, proxy://cost-guide) provide excellent reference material for agents. The cost guide in particular helps agents minimize proxy credit usage.

**Recommendation:** The format asymmetry between fetch and render is a valid design decision (documented in the descriptions). No action needed -- agent UX is already excellent.

---

## 5. Test Coverage (8.5/10)

311 tests across 11 files. All validators are tested. Error classification is tested exhaustively (20+ cases including priority ordering and recoverability flags). Cache behavior (hit/miss, TTL, session bypass, country independence) is well tested. Adapter loading, credential parsing, and proxy URL building are tested for all 5 providers. The crawl tool has integration tests with mocked fetch. CLI tests exercise help, version, status, and error paths via subprocess.

**Issues:**

- [MEDIUM] src/tools/status.ts -- No dedicated test file. The status tool is only tested indirectly through the CLI test (cli.test.ts:73-86) which runs `status` without credentials. No test covers the HEALTHY/DEGRADED/UNAVAILABLE branching logic with mocked network calls.
- [MEDIUM] src/tools/map.ts -- No dedicated test file. Map is tested indirectly through crawl tests (crawl uses the same link extraction pattern). The map-specific logic (include_external, sitemap hint, limit application, external URL filtering) has no unit tests.
- [MEDIUM] src/tools/session.ts -- No dedicated test file. Session verification logic (verify_sticky with two httpbin calls) has no test. Only the validator is tested in validators.test.ts.
- [LOW] src/tools/render.ts -- No test file. The render tool requires a real Puppeteer connection, making it hard to unit test without mocking puppeteer-core. The validator is tested.
- [LOW] src/redact.ts -- No dedicated test file. Redaction is tested indirectly through the integration tests and the error handling path in index.ts, but there are no unit tests for edge cases (e.g., credentials containing regex-special characters, partial matches, encoded values).
- [LOW] src/tools/search.ts -- No dedicated test file. The search tool's API key sanitization and response parsing are untested. The validator is tested in validators.test.ts.

**Recommendation:** Add test files for status (mock httpbin responses), map (test include_external, sitemap hint, limit), and session (mock verify_sticky). These are the highest-value gaps.

---

## 6. Security (9/10)

Credential redaction is systematic: `redact.ts` handles adapter-specific sensitive fields plus NOVADA_API_KEY and NOVADA_BROWSER_WS. Input validation prevents proxy username injection via regex allowlists (SAFE_COUNTRY, SAFE_CITY, SAFE_SESSION_ID -- no hyphens allowed since providers use `-` as segment delimiter). The CSS selector allowlist in render.ts prevents script injection via `wait_for`. The search tool sanitizes the API key from error messages.

**Issues:**

- [MEDIUM] src/tools/search.ts:32-42 -- The NOVADA_API_KEY is passed as a URL query parameter (`api_key=...`). The comment (lines 28-31) acknowledges this is a constraint of the Novada endpoint. The key is sanitized from error messages (line 58-60), but if an unhandled error path surfaces the requestUrl, the key would leak. Currently this is mitigated by the try/catch wrapping all of the axios call, but a future refactor could break this invariant.
- [LOW] src/tools/render.ts:107 -- The CSS selector allowlist regex (`/^[a-zA-Z0-9\s\[\]().#:*>,~+="'_-]+$/`) is restrictive but allows `=` and quotes which are valid in attribute selectors but could theoretically be used in edge-case CSS injection. The risk is minimal since Puppeteer's `waitForSelector` doesn't execute arbitrary code.
- [LOW] src/tools/extract.ts:251-253 -- The `extractJsonLd` function calls `JSON.parse` on content between `<script>` tags. This is safe (JSON.parse doesn't execute code), but malicious JSON-LD could contain very deeply nested structures. The `deepFind` function has a depth limit of 20 (extract.ts:357), which mitigates this.

**Recommendation:** The API key in URL params is a known constraint with adequate mitigation. No urgent action needed.

---

## 7. Performance (8/10)

In-process response cache with configurable TTL (default 300s), LRU eviction, and in-flight request deduplication. Max cache size is 200 entries with oldest-first eviction after pruning expired entries. Render concurrency is limited (default 3, max 20) to prevent runaway Browser API costs. Batch fetch uses a semaphore-based concurrency control (default 3, max 5). Large responses are pre-truncated at 500KB before markdown conversion and output-truncated at 100K chars.

**Issues:**

- [MEDIUM] src/tools/fetch.ts:27-28 -- The cache (`_responseCache`) and in-flight map (`_inflightRequests`) are module-level Maps with no upper bound on the in-flight map size. In practice, in-flight entries are cleaned up via `.finally()`, but if the process handles thousands of concurrent unique URLs, the in-flight map could grow unboundedly during the request burst. The cache has MAX_CACHE_ENTRIES=200, but the in-flight map does not.
- [LOW] src/tools/fetch.ts:43-47 -- `pruneExpired()` iterates all cache entries on every eviction. With MAX_CACHE_ENTRIES=200 this is negligible, but the comment should note this O(n) scan.
- [LOW] src/tools/crawl.ts:214-226 -- When `include_content=true` and `format=markdown`, each page requires two fetches (one markdown, one raw for link extraction). The cost guide documents this correctly (proxy://cost-guide), but the crawl tool could avoid the double fetch by always fetching raw and converting to markdown locally. This would halve credits for markdown+content crawls.
- [LOW] src/tools/fetch.ts:200-202 -- Pre-truncation at 500KB before markdown conversion (`bodyForConversion`) prevents memory issues, but the raw body is fully allocated first (up to 50MB via `maxContentLength`). For very large pages, the Buffer allocation + string conversion could briefly double memory usage.

**Recommendation:** The double-fetch in crawl with include_content+markdown is the most actionable item. Fetching raw and converting locally would reduce costs. The in-flight map is self-cleaning and unlikely to be a problem in practice.

---

## Remaining Issues (prioritized)

1. **[MEDIUM] Test gaps for status, map, session tools** -- These tools have no dedicated test files. Status branching logic, map's include_external/sitemap, and session's verify_sticky are untested. (section 5)
2. **[MEDIUM] Naming layer mismatch** -- npm package `novada-proxy-mcp`, tool prefix `agentproxy_*`, repo URL `proxy4agent`. Not actionable without breaking change, but should be documented. (section 3)
3. **[MEDIUM] Search API key in URL query param** -- Known constraint with adequate error sanitization, but fragile to refactoring. (section 6)
4. **[MEDIUM] Crawl double-fetch for markdown+content mode** -- Could be optimized to fetch raw and convert locally. (section 7)
5. **[LOW] TOOLS array inlined in index.ts** -- 150 lines of definitions could be co-located with handlers. (section 1)
6. **[LOW] Duplicated semaphore pattern** -- batch.ts and crawl.ts both implement acquire/release. (section 1)
7. **[LOW] Countries resource has "tokyo" listed twice** -- src/index.ts:612. Data error. (section 3)
8. **[LOW] Double casts in batch.ts:129 and crawl.ts:306** -- Could be avoided with a wider data type. (section 2)

---

## Comparison to baseline

**What this MCP server does well compared to typical MCP servers:**

- **Agent-first error responses**: Every error includes `code`, `recoverable`, `agent_instruction`, and optional `retry_after_seconds`. Most MCP servers return bare string errors with no recovery guidance. This is the gold standard.
- **Consistent response envelope**: All 9 tools return `{ ok, tool, data, meta }` with cost and cache metadata. Most MCP servers have inconsistent response shapes across tools.
- **Tool chaining guidance**: Each tool description includes WHEN TO USE, USE X INSTEAD, and CHAIN WITH sections. This dramatically reduces agent trial-and-error.
- **Security-by-default**: Input validation with allowlist regexes prevents proxy username injection. Credential redaction is systematic across all error paths (adapter-aware + env var fallback). Most MCP servers don't consider that error messages might contain credentials.
- **Multi-provider adapter pattern**: Clean interface + priority-ordered registry. Adding a new proxy provider requires one file and one line in the registry. No changes to tool handlers.
- **In-process caching with metadata**: Cache hits are visible to the agent (`meta.cache_hit`, `meta.cache_age_seconds`), letting it reason about freshness and cost. Session-pinned requests correctly bypass cache.
- **CLI parity**: Full CLI (novada-proxy) mirrors the MCP server's capabilities 1:1, with --human pretty-printing and structured JSON error output.

**What could improve:**

- Test coverage for 3 tool handlers (status, map, session) has gaps in the actual handler logic (validators are all tested).
- The naming mismatch (novada-proxy-mcp vs agentproxy_*) is a historical artifact that should be documented for contributors.
- The crawl tool's double-fetch behavior for markdown+content mode is a minor performance/cost issue.

Overall, this is a mature, well-architected MCP server that demonstrates strong engineering discipline in agent UX, security, and maintainability. The issues found are polish items, not structural problems.
