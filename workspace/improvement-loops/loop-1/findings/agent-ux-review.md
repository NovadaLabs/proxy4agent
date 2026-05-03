# Agent UX Review — novada-proxy-mcp v1.8.1

## Overall Agent Usability Score: 8.4/10

This is one of the most thoughtfully designed MCP servers for agent consumption I have reviewed. The decision-tree descriptions, `agent_instruction` in every error, and consistent JSON envelope are genuinely best-in-class. The issues below are real but relatively narrow — they prevent a 9+ score, not an 8.

---

## 1. Tool Discoverability (8/10)

**What works:**
- Every tool description includes a `WHEN TO USE` / `USE ... INSTEAD` decision tree. This is the single most important agent UX feature and it is executed well.
- The `ON FAILURE` section in each description tells agents exactly what to do when things go wrong — agents read this and self-correct.
- The README "When To Use Which Tool" section is a clean decision tree. If an agent reads resources, it can find this.
- Tool names are verb-based and semantically grouped: `fetch`, `batch_fetch`, `extract`, `map`, `crawl`, `search`, `render`, `session`, `status`.

**Issues:**

- [MEDIUM] `agentproxy_map` vs `agentproxy_crawl` overlap is confusing. `map` does single-page link extraction. `crawl` does recursive BFS. But "map" and "crawl" are near-synonyms to an LLM — both imply "explore a site." The description says "Crawl a URL and return all internal links" for `map`, which literally uses the word "crawl." An agent asked to "crawl this site and get all links" could pick either tool. The crawl description tries to differentiate ("when you need MORE than a single page") but the initial verb collision creates hesitation.

- [MEDIUM] `agentproxy_session` vs `agentproxy_fetch` with `session_id` — the description of `session` says "For basic sticky routing without verification, use agentproxy_fetch with a session_id parameter instead." This is honest, but it means `session` exists primarily for the `verify_sticky` feature. An agent doing multi-step scraping will be confused about which to use. Most agents will pick `fetch` with `session_id` and never discover `session` exists.

- [LOW] `agentproxy_render` is marked `[BETA]` — agents may deprioritize or avoid it. If it works reliably, remove the tag. If it doesn't, say what might break.

**Fix:**
- Rename `agentproxy_map` to `agentproxy_discover` or `agentproxy_links` to eliminate the crawl/map verb collision. Alternatively, keep `map` but change its description opening from "Crawl a URL..." to "Scan a single page and return all links found on it."
- Consider deprecating `agentproxy_session` and folding `verify_sticky` into `agentproxy_fetch` as an optional parameter. This reduces tool count from 9 to 8 and eliminates the confusion.
- Clarify or remove the `[BETA]` tag on `render`.

---

## 2. Parameter Design (9/10)

**What works:**
- Parameter names are self-explanatory: `url`, `country`, `fields`, `timeout`, `format`, `session_id`, `concurrency`.
- Sensible defaults everywhere: `format="markdown"`, `timeout=60`, `concurrency=3`, `limit=50`.
- Required vs optional is clearly modeled in `inputSchema` with `required` arrays.
- Validation errors are specific and corrective: `"country must be a 2-letter ISO code with no hyphens (e.g. US, DE, GB)"` — this is exactly what an agent needs to self-correct.
- The `session_id` no-hyphens constraint is explained in both the description AND the validation error, preventing a common mistake (agents love to generate UUIDs with hyphens).
- `render_fallback` on `extract` is a brilliant design — it lets agents request auto-escalation without knowing the fallback logic.

**Issues:**

- [LOW] `agentproxy_search` uses `num` for result count, while `agentproxy_map` and `agentproxy_crawl` use `limit`. This inconsistency is minor but could cause an agent to pass `limit` to `search` (silently ignored) or `num` to `map` (silently ignored). Both work because of defaults, but the agent gets unexpected result counts.

- [LOW] `agentproxy_render` accepts `format: "markdown" | "html" | "text"` while `agentproxy_fetch` accepts `format: "markdown" | "raw"`. The asymmetry is justified (render produces clean HTML worth keeping, fetch gets whatever the server sends) but an agent switching from fetch to render might pass `format: "raw"` and get a validation error.

- [LOW] `agentproxy_batch_fetch` requires minimum 2 URLs (`urls.length < 2` throws). An agent with a dynamic list might pass 1 URL and get an error. The error message says "urls must contain between 2 and 20 URLs" which is clear, but agents would benefit from the description mentioning this lower bound.

**Fix:**
- Standardize on `limit` across all tools that control result count. Rename `num` to `limit` in `agentproxy_search` (or alias both and deprecate `num`).
- In `render`'s format enum, accept `"raw"` as an alias for `"html"` to prevent cross-tool confusion.
- In `batch_fetch` description, change "2-20 URLs" to "2-20 URLs (use agentproxy_fetch for single URLs)".

---

## 3. Response Format (9/10)

**What works:**
- Perfectly consistent JSON envelope across all 9 tools: `{ ok, tool, data, meta }` for success, `{ ok, error: { code, message, recoverable, agent_instruction } }` for errors.
- The `tool` field in success responses lets agents confirm which tool produced the result — essential when chaining.
- `meta.cache_hit` and `meta.quota.credits_estimated` are genuinely useful for cost-aware agents.
- `meta.latency_ms` helps agents decide whether to adjust timeouts.
- Truncation is communicated in two ways: `meta.truncated: true` AND an inline `[... truncated — page is large]` marker. Belt and suspenders — good.
- `data.size_bytes` helps agents estimate whether content was truncated significantly.

**Issues:**

- [MEDIUM] `batch_fetch` results use a different shape than `fetch`. A single `fetch` returns `data.content`, but `batch_fetch` returns `data.results[].content`. An agent that chains `search` -> dynamically picks `fetch` or `batch_fetch` based on result count must handle two different response shapes. This is inherent to the batch pattern but worth noting.

- [LOW] `meta.quota.note` is always `"Check dashboard.novada.com for real-time balance"` — pure noise for agents. It consumes tokens on every response. Consider making it a resource (`proxy://quota-info`) instead of embedding it in every response.

- [LOW] `agentproxy_map` returns `data.internal_urls` (array), but `agentproxy_crawl` returns `data.pages` (array of objects with `url` field). An agent trying to chain `crawl` -> `batch_fetch` must extract `.pages[].url` first, while `map` -> `batch_fetch` can pass `data.internal_urls` directly. The crawl response is richer (includes depth, link counts), but the shape difference adds friction.

**Fix:**
- Add `data.urls` as a flat string array to `crawl` results alongside `data.pages` — a convenience field agents can pass directly to `batch_fetch`.
- Remove `meta.quota.note` from responses. Move it to the `proxy://cost-guide` resource.

---

## 4. Error Recovery (9.5/10)

**What works:**
- Every single error path includes `agent_instruction` — this is the gold standard. No other proxy MCP I've reviewed does this.
- `recoverable: boolean` lets agents decide whether to retry or abort without parsing the message.
- `retry_after_seconds` on rate-limit and timeout errors gives agents precise retry timing.
- The `classifyError()` function in `src/errors.ts` maps raw axios errors to typed codes systematically. The pattern matching (TLS, SSL, timeout, ENOTFOUND, etc.) covers the real-world error surface well.
- Credential redaction is thorough — sensitive fields, usernames, API keys, and their URL-encoded variants are all scrubbed.
- `render_fallback` on `extract` is automatic error recovery — the agent doesn't need to implement retry logic.
- The `BOT_DETECTION_SUSPECTED` instruction includes the nuance "If render also returns 4xx, the page may genuinely not exist — stop retrying." This prevents infinite retry loops.

**Issues:**

- [LOW] The `RATE_LIMITED` error says "Wait 5 seconds and retry" but doesn't include the actual `retry_after_seconds` field in the message — the field IS present in the error object, but the instruction text hardcodes "5 seconds" which might not match a future change to the field value. Minor inconsistency.

- [LOW] `UNKNOWN_ERROR` is classified as `recoverable: true` — this is aggressive. Some unknown errors are genuinely unrecoverable (out-of-memory, disk full, etc.). An agent might retry indefinitely on a truly broken state. Consider defaulting to `recoverable: false` for unknown errors, or adding a max-retry hint.

**Fix:**
- Change `UNKNOWN_ERROR` to `recoverable: false` with `agent_instruction: "Check agentproxy_status. If healthy, retry once. If not, stop."` This prevents infinite loops while still allowing one retry.

---

## 5. Prompts & Resources (7.5/10)

**What works:**
- The 5 prompts encode real multi-tool workflows: `research_topic` chains `search` -> `batch_fetch`, `crawl_site` chains `map` -> `batch_fetch`. These are genuinely useful orchestration templates.
- `troubleshoot` prompt is clever — it gives agents a diagnostic workflow when things break.
- The 5 resources are well-chosen reference data: error codes, supported fields, cost guide, countries, workflow patterns.
- `proxy://error-codes` includes the full response format schema — agents can read this once and know the exact shape of every error.
- `proxy://supported-fields` includes extraction strategies — agents know what to expect from each field.

**Issues:**

- [HIGH] MCP prompts are underused by most agent frameworks. Claude Code, Cursor, and Cline rarely invoke prompts automatically — they read tool definitions and call tools directly. The workflow knowledge encoded in prompts (search -> batch_fetch pipeline) should ALSO be in tool descriptions. Currently, the `search` description says "USE agentproxy_fetch INSTEAD FOR: Reading a specific URL you already have" but does NOT say "CHAIN WITH: agentproxy_batch_fetch to read all results." The chaining guidance is only in prompts, which agents may never read.

- [MEDIUM] MCP resources are similarly underused by current agent frameworks. Most agents don't proactively read resources — they're available but not surfaced. The valuable content in `proxy://workflows` and `proxy://cost-guide` should be distilled into tool descriptions or made discoverable through tool response hints.

- [LOW] `proxy://countries` is plain text, not JSON. An agent that wants to validate a country code programmatically can't parse this list. Making it JSON (`{ "americas": ["US", "CA", ...] }`) would be more agent-friendly.

- [LOW] `extract_product` prompt hardcodes `render_fallback: true` — this costs 5 credits if triggered. An agent using this prompt on many products could rack up unexpected costs. The prompt should mention the cost implication.

**Fix:**
- Add `CHAIN WITH:` hints to tool descriptions. Example for `search`: `"CHAIN WITH: agentproxy_batch_fetch to read all result URLs in parallel."` Example for `map`: `"CHAIN WITH: agentproxy_batch_fetch to scrape all discovered URLs."`
- Convert `proxy://countries` to JSON format.
- Add cost warning to `extract_product` prompt.

---

## 6. Tool Chaining (8/10)

**What works:**
- `map` -> `batch_fetch` is a natural pipeline. `map` returns `data.internal_urls` as a flat string array that can be passed directly to `batch_fetch`'s `urls` parameter.
- `search` -> `batch_fetch` works similarly — search returns `data.results[].url` which agents can extract and pass to `batch_fetch`.
- `fetch` -> `extract` is supported via `extract`'s internal use of `fetch`. But an agent could also `fetch(format="raw")` then do its own extraction.
- `extract` with `render_fallback: true` internally chains `fetch` -> `render` automatically — the agent doesn't need to implement this.
- Cache sharing across tools: `map` fetches a page (populating cache), then `batch_fetch` on the same URL gets a cache hit. This cross-tool cache sharing is a genuine cost optimization.

**Issues:**

- [MEDIUM] `crawl` -> `batch_fetch` is awkward. `crawl` returns `data.pages[]` as objects with `{ url, depth, status_code, ... }`, not a flat URL array. An agent must do `.pages.map(p => p.url)` mentally to construct the `batch_fetch` input. Additionally, if `include_content=true`, the crawl already fetched the content — using `batch_fetch` after that would double-fetch. The description says "WORKFLOW: crawl(depth=2) -> get URL tree -> batch_fetch the pages you need" but doesn't warn about the include_content=true overlap.

- [MEDIUM] `search` results use `data.results[].url` but `map` results use `data.internal_urls[]`. An agent building a general "scrape pipeline" must handle different output shapes depending on which discovery tool was used. Standardizing on a `data.urls` convenience field across discovery tools would reduce friction.

- [LOW] `session` -> `session` chaining works but there's no way to verify the session is still alive between calls. If the proxy rotates the IP between calls (best-effort stickiness), the agent doesn't know until it calls `verify_sticky: true`, which costs 2 extra credits. A lightweight "is my session still on the same IP?" check would help.

**Fix:**
- Add `data.urls` (flat string array) to `crawl` response as a convenience field alongside `data.pages`.
- Add `data.urls` (flat string array) to `search` response alongside `data.results`.
- Add `CHAIN WITH:` directives to discovery tool descriptions (see Dimension 5 fix).
- Warn in `crawl` description: "If include_content=true, content is already inline — no need for batch_fetch afterward."

---

## 7. Naming Consistency (6.5/10)

**What works:**
- Tool names follow a consistent `agentproxy_<verb>` pattern.
- Internal function names match tool names: `agentproxyFetch`, `agentproxyBatchFetch`, etc.
- The `tool` field in responses matches the tool name exactly — no aliasing confusion.

**Issues:**

- [CRITICAL] **The `agentproxy_*` prefix does not match the product name `novada-proxy-mcp`.** This is the single largest agent UX issue in the entire project. Here's why it matters:

  When an agent receives tools from an MCP server, it sees tool names in its available tools list. The tool name is the primary identifier. The server name (`novada-proxy-mcp`) appears in the MCP config but is NOT visible to the agent during tool selection.

  An agent told "use Novada to scrape this page" will search its tool list for `novada_*`. It will NOT find any tools — they're all `agentproxy_*`. The agent must infer that `agentproxy_*` tools are from Novada, which requires reading descriptions or making a connection that `agentproxy` = `novada-proxy-mcp`. LLMs can make this connection, but it adds cognitive overhead and failure probability.

  Conversely, an agent that discovers `agentproxy_fetch` in its tool list might not associate it with Novada at all. If the agent has both `novada-mcp` tools AND `agentproxy_*` tools, it sees two apparently different products.

- [HIGH] The prefix `agentproxy` is a legacy name (`proxy4agent` -> `agentproxy`). The npm package is `novada-proxy-mcp`, the GitHub repo is `NovadaLabs/proxy4agent`, the server identifies as `novada-proxy-mcp`, and the tools are `agentproxy_*`. That's three different naming schemes for one product. Every inconsistency is a trap for the next agent.

- [MEDIUM] Environment variables use yet another namespace: `NOVADA_PROXY_USER`, `NOVADA_API_KEY`, `NOVADA_BROWSER_WS`, but also `PROXY4AGENT_CACHE_TTL_SECONDS`, `PROXY4AGENT_MAX_RENDERS`. That's `NOVADA_*` for credentials and `PROXY4AGENT_*` for configuration. An agent reading error messages sees "Set NOVADA_PROXY_USER..." but also "Override limit with PROXY4AGENT_MAX_RENDERS env var."

**Fix:** See Naming Recommendation section below.

---

## Naming Recommendation

### Should tools rename from `agentproxy_*` to `novada_*`?

**Recommendation: YES — rename to `novada_proxy_*`.**

### Pros of renaming to `novada_proxy_*`:

1. **Brand-tool alignment.** npm package is `novada-proxy-mcp`, server name is `novada-proxy-mcp`, tools should be `novada_proxy_*`. One name, one product, zero confusion.

2. **Agent discoverability.** "Use Novada to scrape this" -> agent searches for `novada_*` -> finds tools immediately.

3. **Ecosystem coherence.** If `novada-mcp` (the scraper product) uses `novada_*` tools, having the proxy also use `novada_proxy_*` creates a clear namespace: `novada_scrape`, `novada_search` (from novada-mcp) vs `novada_proxy_fetch`, `novada_proxy_render` (from novada-proxy-mcp).

4. **Environment variable alignment.** `NOVADA_PROXY_USER` credentials -> `novada_proxy_fetch` tool. The naming chain is coherent.

5. **Future-proofing.** If Novada adds more MCP servers (e.g., `novada-browser-mcp`), the `novada_<product>_<action>` pattern scales.

### Cons of renaming:

1. **Breaking change.** Existing users who reference `agentproxy_fetch` in their agent configs, prompts, or code will break. This requires a major version bump (v2.0.0).

2. **Migration friction.** Users must update their prompts/configs. Agents that have learned `agentproxy_*` patterns in context/memory must relearn.

3. **SEO/discoverability loss.** "agentproxy" is somewhat unique and memorable. "novada_proxy" is more corporate but less distinctive.

4. **Prefix length.** `novada_proxy_batch_fetch` (24 chars) vs `agentproxy_batch_fetch` (22 chars) — negligibly longer, but every token matters for agents.

### Mitigation strategy for the rename:

1. **v1.9.0**: Add `novada_proxy_*` as aliases that point to the same handlers. Both prefixes work. Emit a deprecation notice in `meta` when `agentproxy_*` is used: `"meta.deprecation": "agentproxy_* tools are deprecated. Use novada_proxy_* instead. Alias support ends in v3.0."`.

2. **v2.0.0**: `novada_proxy_*` becomes primary. `agentproxy_*` aliases still work but emit stronger warnings.

3. **v3.0.0**: Remove `agentproxy_*` aliases entirely.

### Alternative: `novada_*` (without `proxy`)?

Too generic. Would collide with `novada-mcp` tools. The `proxy` qualifier is necessary to distinguish the proxy product from the scraper product.

### Also rename env vars:

`PROXY4AGENT_CACHE_TTL_SECONDS` -> `NOVADA_PROXY_CACHE_TTL`
`PROXY4AGENT_MAX_RENDERS` -> `NOVADA_PROXY_MAX_RENDERS`

Support old names as fallbacks for one major version.

---

## Top 5 Agent UX Fixes

Ranked by impact on agent first-try success rate:

### 1. Rename tools from `agentproxy_*` to `novada_proxy_*` (Naming, Critical)
Impact: Eliminates the #1 source of agent confusion — product name doesn't match tool prefix. Do it via alias migration over 3 versions.

### 2. Add `CHAIN WITH:` hints to tool descriptions (Chaining + Discoverability, High)
Impact: Agents currently don't know the optimal pipeline without reading prompts/resources (which most don't). Adding one line to each discovery tool's description — "CHAIN WITH: agentproxy_batch_fetch to scrape discovered URLs" — dramatically improves first-try workflow construction. This is the highest-ROI change possible.

### 3. Add `data.urls` convenience field to `crawl` and `search` responses (Chaining, Medium)
Impact: Eliminates the `.pages.map(p => p.url)` or `.results.map(r => r.url)` step agents must mentally perform before chaining to `batch_fetch`. One flat array of URLs ready to pass downstream.

### 4. Rename `agentproxy_map` description from "Crawl a URL..." to "Scan a single page..." (Discoverability, Medium)
Impact: Eliminates the map/crawl verb collision that causes hesitation. "Scan" is clearly different from "crawl."

### 5. Remove `meta.quota.note` from every response (Response Format, Low but pervasive)
Impact: Saves ~15 tokens per tool call. Over a 20-URL batch, that's 300 wasted tokens. Move the note to the `proxy://cost-guide` resource.

---

## Simulated Agent Test

For each tool, I simulate a natural-language request and evaluate: (1) would the agent pick the right tool, (2) would it pass correct params, (3) would it interpret the response correctly.

### agentproxy_fetch
**Request:** "Read the content of https://news.ycombinator.com"
**Tool selection:** PASS. Agent would pick `fetch` — the description clearly says "Fetch any URL."
**Params:** PASS. Agent would pass `{ url: "https://news.ycombinator.com" }`. Defaults handle the rest.
**Response parsing:** PASS. `data.content` is intuitive. `meta.cache_hit` is bonus info.

### agentproxy_batch_fetch
**Request:** "Scrape these 5 product URLs and get their content"
**Tool selection:** PASS. "multiple URLs" -> `batch_fetch`.
**Params:** PASS. `{ urls: [...5 urls] }`. Agent might also pass `format: "markdown"`.
**Response parsing:** PASS. `data.results[]` with per-URL `ok`/`error` is clear.

### agentproxy_extract
**Request:** "Get the title and price from this Amazon product page"
**Tool selection:** PASS. "title and price" -> structured fields -> `extract`.
**Params:** PASS. `{ url: "...", fields: ["title", "price"] }`. Might add `render_fallback: true` if description is read.
**Response parsing:** PASS. `data.fields.title` and `data.fields.price` are exactly what was requested.

### agentproxy_map
**Request:** "Find all pages on books.toscrape.com"
**Tool selection:** UNCERTAIN. Agent might pick `crawl` instead of `map` — both descriptions mention crawling. If the agent reads carefully, `map` says "single page" and `crawl` says "recursively." But first-instinct selection is a coin flip for "find all pages." **Partial FAIL.**
**Params:** PASS if selected. `{ url: "https://books.toscrape.com" }`.
**Response parsing:** PASS. `data.internal_urls` is a clean array.

### agentproxy_crawl
**Request:** "Crawl example.com to depth 3 and get all URLs"
**Tool selection:** PASS. "crawl" + "depth" clearly maps to `crawl`.
**Params:** PASS. `{ url: "https://example.com", depth: 3 }`.
**Response parsing:** PARTIAL. Agent gets `data.pages[]` but must extract `.url` from each object to chain to `batch_fetch`. Not a failure, but friction.

### agentproxy_search
**Request:** "Search Google for 'best residential proxy 2024'"
**Tool selection:** PASS. "Search Google" -> `search`.
**Params:** PASS. `{ query: "best residential proxy 2024" }`.
**Response parsing:** PASS. `data.results[].url` and `data.results[].snippet` are intuitive.

### agentproxy_render
**Request:** "This React app returns blank with fetch, render it with a real browser"
**Tool selection:** PASS. Description explicitly says "SPAs, React/Vue apps."
**Params:** PASS. `{ url: "..." }`. Agent might pass `wait_for: ".main-content"`.
**Response parsing:** PASS. Same shape as `fetch` response.

### agentproxy_session
**Request:** "Scrape 3 pages from this site using the same IP"
**Tool selection:** UNCERTAIN. Agent might use `fetch` with `session_id` (which works) or `session` (also works). The `session` description says "For basic sticky routing without verification, use agentproxy_fetch with session_id instead." This pushes agents AWAY from `session`. **Not a failure, but the tool's own description undermines its selection.**
**Params:** PASS if selected. `{ session_id: "scrape_001", url: "..." }`.
**Response parsing:** PASS.

### agentproxy_status
**Request:** "Check if the proxy is working"
**Tool selection:** PASS. Unmistakable.
**Params:** PASS. No params needed.
**Response parsing:** PASS. `data.connectivity.status` is "HEALTHY"/"DEGRADED"/"UNAVAILABLE" — clean enum.

### Summary
- **7/9 tools: clean first-try success** (fetch, batch_fetch, extract, crawl, search, render, status)
- **2/9 tools: selection ambiguity** (map vs crawl; session vs fetch+session_id)
- **0/9 tools: param or response failure**

The parameter design and response format are strong. The weak point is tool selection ambiguity between map/crawl and session/fetch.

---

## Additional Observations

### Security
- Credential redaction is thorough — `sensitiveFields`, raw usernames, API keys, and URL-encoded variants are all scrubbed.
- The `wait_for` CSS selector on `render` is validated against a safe character allowlist — no injection risk.
- `SAFE_COUNTRY`, `SAFE_CITY`, `SAFE_SESSION_ID` regex validation prevents proxy username injection via hyphen-delimited segments. This is a real attack vector and it's properly defended.

### Performance
- The in-process cache with LRU eviction and 300s TTL is well-designed. Cache keys include `country` (geo-specific content) but not `session_id` (sticky sessions bypass cache). This is correct.
- `MAX_CONCURRENT_RENDERS = 3` prevents runaway Browser API costs. The limit is configurable via env var.
- `unicodeSafeTruncate` prevents splitting surrogate pairs at the 100K char boundary — a subtle but important correctness detail.

### Documentation
- The README is comprehensive and bilingual (English + Chinese). Both versions are consistent.
- The "Known Limitations" section is honest — proxy-side DNS errors surfacing as TLS_ERROR, extraction heuristics vs LLM, etc.

### Missing Features (not UX issues, but worth noting)
- No `agentproxy_screenshot` tool for visual page capture.
- No pagination support — agents must handle pagination logic themselves.
- No webhook/callback for async long-running crawls — all operations are synchronous.
