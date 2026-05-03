# Changelog

## v1.8.2 (2026-05-03)

### Added
- `novada_proxy_research` — one-shot deep research tool (search → fetch → findings)
- Schema-based LLM extraction mode for `novada_proxy_extract` (pass `schema` instead of `fields`)
- `stripNoiseElements` — removes nav/header/footer/ads before markdown conversion
- `content_density` score in fetch responses
- `data.urls` convenience field in crawl and search responses
- CHAIN WITH hints in tool descriptions
- In-flight request deduplication for cache

### Changed
- Renamed all tools from `agentproxy_*` to `novada_proxy_*`
- Renamed all functions from `agentproxy*` to `novadaProxy*`
- Renamed env vars `PROXY4AGENT_*` to `NOVADA_PROXY_*` (old names kept as fallback)
- Standardized `num` → `limit` parameter in search
- Map tool description: "Crawl" → "Scan" to avoid confusion with crawl tool
- Crawl now fetches raw + converts markdown locally (halves proxy credits)

### Removed
- `meta.quota.note` from all responses (saves ~15 tokens per call)

### Fixed
- Shared credential redaction (was copy-pasted in 4 places)
- InputValidationError typed class for cleaner error classification
- Schema key sanitization prevents prompt injection
- Tokyo duplicate removed from countries resource

---

## v1.9.0 (2026-04-13)

### New tool: `novada_proxy_batch_fetch`

- Fetch 2-20 URLs concurrently through residential proxy with up to 5 parallel requests (default 3).
- Returns `{ok, data: {requested, succeeded, failed, results[]}, meta: {latency_ms, concurrency, quota}}`.
- Each result has `{url, ok, status_code?, content?, size_bytes?, error?, latency_ms}`.
- Individual URL failures are captured in `results[].error` — the batch itself always returns `ok: true`.
- `validateBatchFetchParams` — validates 2-20 URLs, concurrency 1-5, input injection guards.

### Quota/cost metadata stub (`QuotaMeta`)

- All 7 tools now return `meta.quota: { credits_estimated, note }` in their success responses.
- Credit estimates: `fetch` = 1, `session` = 1 (+2 if `verify_sticky`), `extract` = 1, `search` = 1, `status` = 1, `render` = 5, `batch_fetch` = N (one per URL).
- Enables cost-aware agents to track consumption. Not real billing data — stub only.
- `QuotaMeta` interface added to `src/types.ts`.

### `novada_proxy_session` description update

- Added warning: `verify_sticky:true makes 3 sequential proxy calls and adds ~15-25 seconds.`

## v1.8.0 (2026-04-13)

### Agent-first output format

- **Structured JSON responses** — all 6 tools now return `{ok, tool, data, meta}` envelope instead of formatted prose strings. Agents can `JSON.parse()` responses directly without text parsing.
- **`src/types.ts`** — shared `ProxySuccessResponse`, `ProxyErrorResponse`, `ProxyErrorCode` types.
- **`novada_proxy_fetch`** — returns `data.{url, status_code, content, content_type, size_bytes}` + `meta.{latency_ms, country, session_id, truncated}`.
- **`novada_proxy_search`** — returns `data.{query, engine, count, results[]}` where each result is `{title, url, snippet}`.
- **`novada_proxy_extract`** — returns `data.{url, fields}` as a key-value map.
- **`novada_proxy_render`** — returns `data.{url, content, format}`.
- **`novada_proxy_session`** — wraps fetch result, adds `verify_sticky` param. When `verify_sticky:true`, makes two httpbin.org/ip calls and sets `meta.session_verified`.
- **`novada_proxy_status`** — rewrote to do live proxy connectivity check via httpbin.org/ip instead of hitting broken gateway endpoint. Returns `data.{provider, version, capabilities, connectivity.{status, verified_via, proxy_ip, latency_ms}}`.
- **Centralized error classification** (`classifyError`) — maps axios errors to typed `ProxyErrorCode` with `agent_instruction` and `retry_after_seconds`. Error responses are also structured JSON.
- **Agent-first tool descriptions** — all 6 descriptions updated with WHEN TO USE / USE INSTEAD / ON FAILURE decision trees.
- **Concurrent render limit** — now returns structured JSON error instead of plain text.

## v1.5.0 (2026-04-09)

### Phase 6 — MCP registry listings

- **`smithery.yaml`** added — Smithery auto-discovers the server from this file. Full config schema covers all 5 providers (Novada, BrightData, Smartproxy, Oxylabs, Generic). No env var is required — each is optional, and Smithery's UI will surface them cleanly.
- **`package.json` keywords expanded** — added `brightdata`, `smartproxy`, `oxylabs`, `cloudflare-bypass`, `sticky-session`, `windsurf`, `web-fetch` for npm discovery and registry indexing.
- **`package.json` metadata** — added `homepage`, `repository`, `bugs` fields (required by most registries).
- **`smithery.yaml` in `files`** — included in the published npm tarball.
- **Smithery badge** added to README.
- **Compatible With section** added — install instructions for Claude Code, Cursor, Windsurf, Cline, Continue, and Smithery. JSON config block for non-Claude clients.

### Phase 5 — novada_proxy_render live verification

- **End-to-end test confirmed** — real Chromium session via Novada Browser API.
- **React.dev** (266 KB JS-heavy SPA): full page rendered, navigation, components, code examples extracted cleanly.
- **HackerNews with `wait_for=".athing"`**: selector waited, all 30 stories present in output.
- **httpbin.org/html**: basic connection + markdown extraction confirmed.
- **README updated** — live render results added to Real-World Results section.

### Phases 3 & 4 — BrightData, Smartproxy, Oxylabs adapters

- **`BrightDataAdapter`** — dedicated adapter for BrightData (formerly Luminati). Set `BRIGHTDATA_USER` + `BRIGHTDATA_PASS`. Auto-encodes country, city, session into BrightData's username-suffix format (`-country-XX`, `-city-CITY`, `-sid-ID`). Optional `BRIGHTDATA_HOST` / `BRIGHTDATA_PORT`.
- **`SmartproxyAdapter`** — dedicated adapter for Smartproxy. Set `SMARTPROXY_USER` + `SMARTPROXY_PASS`. Country encoded as `-country-XX` (uppercase). Optional `SMARTPROXY_HOST` / `SMARTPROXY_PORT` (default: `gate.smartproxy.com:10001`).
- **`OxylabsAdapter`** — dedicated adapter for Oxylabs. Set `OXYLABS_USER` + `OXYLABS_PASS`. Country encoded as `-cc-XX`, session as `-sessid-ID`. Optional `OXYLABS_HOST` / `OXYLABS_PORT` (default: `pr.oxylabs.io:7777`).
- **Adapter priority** — Novada → BrightData → Smartproxy → Oxylabs → Generic HTTP. First configured wins. Novada is always first.
- **README Providers section** — updated with dedicated install sections and a full capability comparison table for all 5 providers.

### Phase 2 — Generic HTTP Proxy adapter

- **`PROXY_URL` support** — set `PROXY_URL=http://user:pass@host:port` to use any HTTP proxy provider. Instantly compatible with BrightData, Smartproxy, Oxylabs, IPRoyal, and any standard HTTP CONNECT proxy.
- **Provider priority** — Novada wins if both `NOVADA_PROXY_USER` and `PROXY_URL` are set. Generic adapter is a fallback, not a replacement.
- **Capability warnings** — if `country`, `city`, or `session_id` params are passed to the generic adapter (which can't encode them automatically), a warning is logged to stderr. The fetch still proceeds — params are simply not injected into the URL.
- **`novada_proxy_status` upgraded** — now shows active provider name, last-verified date, and supported capabilities alongside network health.
- **README Providers section** — documents Novada + generic adapter with install commands for BrightData, Smartproxy, Oxylabs, IPRoyal.

## v1.4.5 (2026-04-09)

### Phase 1 — Provider adapter architecture

- **`src/adapters/` layer** — `ProxyAdapter` interface, `NovadaAdapter`, registry + `resolveAdapter()`. Adding a new provider = one new file, one registry line.
- **Auto-detection** — credentials read once at startup; first adapter with valid credentials wins. Novada always first.
- **Systematic credential redaction** — error messages scrub all sensitive adapter fields, not just hardcoded env var names.
- **`novada_proxy_status`** — now shows active provider with verified date and capabilities.
- **Missing credentials error** — now lists all registered providers with their credential docs.

---

## v1.4.3 (2026-04-09)

### What's new
- **Real-world results in README** — live output from actual API calls: US/JP geo-targeting, sticky session confirmation (same IP across 2 requests), Amazon 1.6 MB page bypass, HackerNews full extraction, Google search results.

---

## v1.4.2 (2026-04-09)

### Security fixes
- **Proxy username injection via country/city** — `SAFE_PARAM` allowed hyphens; `country="us-session-injected"` silently forged proxy auth segments. All username params now use `/^[a-zA-Z0-9_]+$/` (no hyphens).
- **NaN bypasses timeout validation** — `NaN < 1` is false, so non-numeric inputs passed range checks. Added `Number.isFinite()` guard in all validators (fetch, session, render, search).
- **Search non-Axios errors leaked API key** — non-network errors re-thrown raw with potential API key in message. Now sanitized through the same `replaceAll` path.

### Bug fixes
- **sourceMappingURL directives in published JS** — `sourceMap: true` in tsconfig wrote dangling `//# sourceMappingURL` comments after `.map` files were excluded. Fixed: `sourceMap: false`, `declarationMap: false`.
- **PROXY_PORT accepts out-of-range values** — `"99999"` or `"-1"` passed through silently. Added `Number.isInteger` + range check `> 0 && < 65536`.
- **Length caps added** — `session_id` ≤ 64, `country` ≤ 10, `city` ≤ 50, `wait_for` ≤ 200 chars. Previously unbounded inputs caused cryptic 407 proxy errors.
- **search.ts country/language validated at call site** — previously only validated in `validateSearchParams`, allowing direct callers to bypass sanitization.

---

## v1.4.1 (2026-04-09)

### Security fixes
- **Country/city hyphen injection** — `SAFE_PARAM` allowed hyphens, enabling a caller to forge proxy username segments via `country="us-session-injected"`. All proxy auth params now use `SAFE_COUNTRY`/`SAFE_CITY`/`SAFE_PARAM` = `/^[a-zA-Z0-9_]+$/` (no hyphens).

### Bug fixes
- **NaN bypasses timeout validation** — `NaN < 1` and `NaN > 120` are both false, so non-numeric timeout values passed validation and produced `axios({ timeout: NaN })` (no timeout = hung request). Fixed with `Number.isFinite()` guard in fetch, session, render, and search validators. Same fix applied to `num` in search (was returning `[]` silently for NaN).
- **Non-Axios errors in search re-thrown raw** — network errors not caught by `axios.isAxiosError()` were re-thrown with potential API key exposure in the message. Now sanitized through the same `replaceAll` path.

### Package
- **Source maps excluded from published tarball** — `files` now explicitly lists `build/**/*.js` and `build/**/*.d.ts`, dropping ~25 KB of `.js.map` files irrelevant to CLI consumers.
- **CHANGELOG.md added to published tarball** — was missing from `files`.

### Cleanup
- Stale Bing-era comments removed from `search.ts`.

---

## v1.4.0 (2026-04-09)

### What's new
- **Renamed to `novada-proxy-mcp`** — unified product naming under the Novada brand.
- **CHANGELOG.md** — added to track what changed in every version going forward.
- **`--help` text reordered** — proxy credentials listed first (core product), API key and browser WS listed after (secondary tools).
- **`http-proxy-agent` added** — `httpAgent` now correctly uses `HttpProxyAgent` for plain HTTP targets; `httpsAgent` uses `HttpsProxyAgent` for HTTPS (CONNECT tunnel + TLS). Both were previously the same `HttpsProxyAgent` instance.
- **`NOVADA_PROXY_PORT` env var** — replaces legacy `AGENTPROXY_PROXY_PORT` (removed). Allows overriding the proxy port if your plan uses a non-standard one.

### Bug fixes
- **NOVADA_PROXY_USER not redacted in error messages** — proxy usernames (e.g. `user123-zone-res-region-us`) appeared verbatim in 407/connection error messages. Added `replaceAll` redaction alongside the existing pass/key redaction.
- **IPLoop fallback removed from `novada_proxy_status`** — `gateway.iploop.io:9443/health` was silently called when the Novada status endpoint failed. Removed entirely; status now returns UNKNOWN cleanly if unreachable.
- **Render timeout applied twice** — `page.goto()` and `page.waitForSelector()` each received the full timeout, so real elapsed time could be 2× the user-specified value. Fixed with a shared deadline.
- **`decompress()` silent failure** — when a server declared `Content-Encoding: gzip` but body was undecompressable, the function fell through to returning raw binary as UTF-8. It now throws on explicitly-declared encodings (triggering the retry loop); silent fallback retained only when no header is present.
- **Legacy `AGENTPROXY_PROXY_HOST` / `AGENTPROXY_PROXY_PORT` env vars removed** — stale after rename, undocumented.
- **README "Why AgentProxy" heading** — renamed to "Why Proxy4Agent".
- **`novada_proxy_status` + `novada_proxy_session` + `novada_proxy_render` URL scheme validation** — all three `validateXxxParams` functions now check `http://`/`https://` prefix at the boundary, consistent with `fetch.ts`.
- **`novada_proxy_search` country/language injection** — `country` and `language` params forwarded to API without validation; now checked against `SAFE_LOCALE` pattern.
- **`--list-tools` split broke on URLs** — was splitting description on first `.`, which broke descriptions containing `.com` URLs. Now splits on `. ` (period + space).
- **`node -e require(...)` in ESM package** — `build` script used CommonJS `require` in a `"type": "module"` package; fixed with `--input-type=commonjs`.
- **Class renamed** — `AgentProxyServer` → `Proxy4AgentServer`.

---

## v1.3.0 (2026-04-08)

### What's new
- **Full Novada native migration** — removed all IPLoop references from user-facing code
- **Correct Novada proxy auth format** — `USERNAME-zone-res[-region-XX][-city-YY][-session-ID]` discovered from official docs and confirmed via live testing
- **`NOVADA_PROXY_HOST` env var** — account-specific host for reliable sticky sessions (defaults to `super.novada.pro` for rotating)
- **`novada_proxy_render` rewrite** — switched from dead REST endpoint to real Novada Browser API (WebSocket + puppeteer-core); page always closed in `finally` to prevent server-side session leaks
- **Per-tool missing credential errors** — each tool now surfaces actionable instructions when its specific env var is missing
- **`replaceAll` credential redaction** — all env vars fully redacted from error messages (not just first occurrence)

### Bug fixes
- **Session IDs with hyphens silently broken** — Novada uses `-` as the username param delimiter; session IDs like `my-session` produced ambiguous auth strings. `SAFE_SESSION_ID` now disallows hyphens. Error message updated.
- **Bing search returning wrong-language results** — Novada Scraper API Bing integration broken at server level (returned Spanish Gmail for English proxy queries). Removed Bing, DuckDuckGo, Yahoo, Yandex. Google only.
- **Bing `num` param ignored** — API always returned 10 results regardless of `num`. Added client-side `results.slice(0, num)` cap.
- **Click-tracking URLs in search results** — `r.link` was returning Bing tracker URLs (`bing.com/ck/a?...`). Fixed: now uses `r.redirection_link || r.url || r.link`.
- **`BROWSER_WS_HOST` dead export** — removed unused export from `config.ts`
- **Scheme validation moved to boundary** — `validateFetchParams` now checks `http://`/`https://` prefix so the error surfaces at the MCP boundary, not inside the fetch function
- **`isRetryable` logic** — only retries network errors and 5xx; never retries 4xx (auth failures, not-found, etc.)

### Removed
- IPLoop proxy backend and all `IPLOOP_*` env vars
- Bing, DuckDuckGo, Yahoo, Yandex search engines (broken at API level)
- `GATEWAY_URL` export from `config.ts`

---

## v1.2.0 (2026-04-08)

### What's new
- **Independent reviewer audit** — all issues from first code review resolved before publish
- **`utils.ts`** — extracted shared utilities (`htmlToMarkdown`, `htmlToText`, `unicodeSafeTruncate`) used across fetch and render
- **Retry logic** — fetch and session tools retry once on network errors and 5xx
- **`decompress` function** — manual gzip/brotli/deflate decompression to fix ECONNABORTED on large pages (e.g. Amazon 1.6MB)
- **`maxContentLength: 50MB`** — prevents axios from choking on large pages

### Bug fixes
- `novada_proxy_fetch` was using `decompress: true` which conflicted with the https-proxy-agent CONNECT tunnel on large pages
- `htmlToMarkdown` and `unicodeSafeTruncate` duplicated between files — consolidated into utils.ts

---

## v1.1.0 (2026-04-08)

### What's new
- **Single `NOVADA_API_KEY`** — replaced multi-key setup with one key for all Novada API access
- **`novada_proxy_render`** — new tool for JavaScript-heavy pages using Novada Browser API
- **`novada_proxy_status`** — new tool for proxy network health check (no credentials required)
- **`novada_proxy_session`** — sticky session tool with dedicated endpoint

---

## v1.0.0 (2026-04-08)

Initial release.

- `novada_proxy_fetch` — residential proxy fetch with country/city/session targeting
- `novada_proxy_search` — structured web search via Novada Scraper API
- 5 MCP tools total
- Node.js 18+, stdio transport
