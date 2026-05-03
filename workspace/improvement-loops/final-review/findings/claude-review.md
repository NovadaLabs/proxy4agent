# Final Product Review — novada-proxy-mcp

**Reviewer:** Claude Sonnet 4.6 (fresh eyes, no prior context)
**Date:** 2026-04-29
**Version reviewed:** 1.8.1 (package.json) / 1.9.0 (CHANGELOG top entry) — **mismatch**

---

## Overall Score: 7.9/10
## Ship Recommendation: HOLD — 4 documentation fixes required (all <30 min total)

---

## Dimension Scores

| Dimension | Score | Key Finding |
|-----------|-------|-------------|
| 1. Completeness | 9/10 | All 10 tools functional. Full lifecycle: discover → fetch → extract → research. CLI mirrors MCP 1:1. |
| 2. Consistency | 7/10 | Tool naming clean (novada_proxy_*). Two env vars still use PROXY4AGENT_ prefix instead of NOVADA_. CHANGELOG top entry says v1.9.0 but package.json is 1.8.1. |
| 3. Content Quality | 8/10 | htmlToMarkdown + stripNoiseElements solid. Schema mode for LLM extraction is genuinely useful. content_density is a nice signal. Heading extraction regex misses headings with nested tags. |
| 4. Competitive Position | 7/10 | Beats competitors on multi-provider support, agent-first errors, and schema-mode extraction. Behind Firecrawl on markdown quality and crawl depth. Behind Tavily on search result diversity. |
| 5. Agent UX | 9/10 | Decision trees in every description are excellent. WHEN TO USE / USE INSTEAD / ON FAILURE pattern is best-in-class. research tool is genuinely useful (not just a thin wrapper). |
| 6. Security | 9/10 | Comprehensive: injection prevention on all proxy params, NaN guards, credential redaction at every error path, wait_for selector allowlist, API key not in headers. Minor: rate-limit error in fetch.ts thrown as a plain string, not through classifyError. |
| 7. Documentation | 6/10 | Multiple stale counts: README says "9 tools at a glance" (should be 10), badge says "tests-320" (actual: 430), nav link anchors point to nonexistent heading IDs. Chinese section tool count is inconsistent. |
| 8. Ship Readiness | 7/10 | Build clean. 430 tests pass. No stray console.log in production paths. Version mismatch: package.json=1.8.1, CHANGELOG top=v1.9.0, config.ts=1.8.1. |

---

## Critical Issues (must fix before publish)

### 1. Version mismatch — package.json 1.8.1 vs CHANGELOG top entry v1.9.0
**File:** `package.json:3`, `src/config.ts:1`, `CHANGELOG.md:3`

The CHANGELOG top entry is `## v1.9.0 (2026-04-13)` describing `agentproxy_batch_fetch` as a new tool. But `package.json` says `"version": "1.8.1"` and `src/config.ts` says `VERSION = "1.8.1"`. This is the most disqualifying issue — developers will see `v1.8.1` on npm but read changelog entries for v1.9.0. Either bump the version to 1.9.0 (if those features are included) or move the 1.9.0 CHANGELOG entry to an "Unreleased" section.

**Note:** The test run shows 430 tests but the old audit (2026-04-29, same day) said 411. The product has been updated since that audit.

---

### 2. README tool count says "9 tools at a glance" — actual count is 10
**Files:** `README.md:40`, `README.md:698`

- Line 40: nav anchor `#9-tools-at-a-glance` (points to heading that reads "10 Tools at a Glance")
- Line 698: Chinese nav anchor `#9-个工具` (points to heading that reads "10 个工具")

Both anchors will silently fail (dead links) if the heading text was updated to 10 but the anchors weren't. Fix: change `#9-tools-at-a-glance` to `#10-tools-at-a-glance` and `#9-个工具` to `#10-个工具`.

---

### 3. Test badge says 320 — actual count is 430
**File:** `README.md:21`

```
<img src="https://img.shields.io/badge/tests-320-brightgreen?style=flat-square" alt="320 tests">
```

The test suite runs 430 tests (verified via `npm test`). Chinese section also says "测试-320个". Both are stale.

---

### 4. PROXY4AGENT_* env vars are not NOVADA_* — inconsistency in brand/naming
**Files:** `src/tools/fetch.ts:30`, `src/index.ts:50`, `README.md:538`, `README.md:870`

Two config env vars use the old `PROXY4AGENT_` prefix:
- `PROXY4AGENT_CACHE_TTL_SECONDS` — controls cache TTL
- `PROXY4AGENT_MAX_RENDERS` — controls render concurrency

All other env vars are `NOVADA_*`. This is a namespace inconsistency that will confuse developers. Either rename to `NOVADA_CACHE_TTL_SECONDS` / `NOVADA_MAX_RENDERS` or document clearly in the README that these two use a different prefix and why (backward compat). Currently they are documented in README and code comments but the prefix mismatch is unexplained.

---

## Important Issues (should fix, not blocking)

### 5. --help text lists only 6 tools (missing batch_fetch, map, crawl, research)
**File:** `src/index.ts:879-884`

The `--help` output under `Tools:` lists only 6 tools. An agent or developer running `npx novada-proxy-mcp --help` would think 4 tools don't exist. Low priority since the README is the main discovery surface, but adds friction.

### 6. research tool synthesis is heuristic, not actual synthesis
**File:** `src/tools/research.ts:99-107`

The "synthesis" field concatenates the first paragraph of each source with attribution — it's not a synthesis, it's a concatenation. The tool description says "returns a structured synthesis" which sets expectations too high. Either:
- Rename it `findings_summary` to match what it actually does, or
- Add a clear note in the description: "synthesis is a concatenated preview — your agent should analyze findings[] for actual synthesis"

This is an agent UX issue — an LLM receiving this response may stop reasoning and treat the "synthesis" as authoritative when it's just raw excerpts stitched together.

### 7. htmlToMarkdown doesn't handle nested tags in headings
**File:** `src/utils.ts:117`

```typescript
.replace(/<h([1-6])[^>]*>/gi, (_, n) => "#".repeat(Number(n)) + " ")
```

A heading like `<h2><a href="...">Text</a></h2>` becomes `## [Text](url)` — technically correct but not clean markdown. More importantly, `<h2 class="title"><span>Product Name</span></h2>` becomes `## ` with no text (the span content isn't in the capture group). The `extractTag` in extract.ts has the same issue: `/<h1[^>]*>([^<]+)<\/h1>/` misses anything inside a nested element. This affects how many real-world product title extractions will return null.

### 8. rate-limit error path in fetch.ts bypasses classifyError
**File:** `src/tools/fetch.ts:221-224`

```typescript
if (axios.isAxiosError(err) && err.response?.status === 429) {
  throw new Error("Rate limited (HTTP 429). Wait a moment before retrying...");
}
```

This throws a plain string error that bypasses the structured `classifyError` pipeline in `src/errors.ts`. The error that surfaces to the agent will be an `UNKNOWN_ERROR` with a plain message, not a `RATE_LIMITED` with `retry_after_seconds: 5`. The correct fix is to throw an error that classifyError will match on status 429 — or just let it fall through to the Axios handler already in classifyError.

### 9. novada_proxy_extract requires `fields` OR `schema` but validation error message is confusing
**File:** `src/tools/extract.ts:471-476`

When neither `fields` nor `schema` is provided, the error is:
> `"fields is required — provide an array of field names..."`

An agent that read the description knows about schema mode but might be confused why it's told fields is required when it thought schema was acceptable. The error message should be: `"Either fields (array) or schema (object) is required."`

---

## Competitive Verdict

### vs Firecrawl MCP
**We win:** Multi-provider support (5 providers), schema-mode LLM extraction, sticky session verification, agent_instruction in every error, `content_density` signal, batch concurrency control.
**They win:** Firecrawl's markdown conversion is better quality (uses Readability + Turndown internally, not hand-rolled regex). Firecrawl supports screenshot capture. Their crawl supports JS rendering natively — ours requires a separate render tool and a Browser API key.
**Verdict:** A developer scraping static pages should consider us equivalent. A developer scraping SPAs will find Firecrawl's render-by-default more convenient.

### vs Tavily MCP
**We win:** Everything proxy-related (geo-targeting, anti-bot bypass, sticky sessions). Tavily is search-only.
**They win:** Tavily's search quality is higher — they deduplicate, rank, and extract relevant excerpts. Our `novada_proxy_search` returns raw organic results with no relevance ranking beyond Google's order.
**Verdict:** Different products. Use Tavily for research queries, use us when you need to fetch pages that require proxy bypass.

### vs BrightData MCP
**We win:** We *support* BrightData as one of 5 providers. We also have search + render in one package. BrightData MCP is proxy-only.
**They win:** BrightData's scraping unlocker is more reliable for heavily-protected sites (they have managed anti-bot bypass infrastructure). BrightData has a dataset API (structured datasets) that we don't.
**Verdict:** For pure anti-bot reliability, BrightData wins. For a complete agent toolchain (search + proxy + render + extract in one package), we win.

### Unique differentiators
1. Multi-provider in one package — developers can switch providers by changing env vars
2. schema-mode extraction — returns cleaned content + extraction prompt for arbitrary LLM extraction without extra API calls
3. agent_instruction in every error — best error UX of any proxy MCP reviewed
4. Content_density signal — unique, genuinely useful for agents deciding whether to re-fetch in render mode
5. research tool — search + fetch + preview in one call, no pipeline orchestration needed

---

## Ship Decision Rationale

**HOLD** — the version mismatch (package.json says 1.8.1, CHANGELOG says 1.9.0) is a credibility-killer. A developer who reads the CHANGELOG before installing will see feature entries that predate the published version. This creates confusion about what's actually in the package.

The three other critical issues (tool count, test count, dead anchor links) are all cosmetic but they're visible immediately on the npm page and README. A developer evaluating this tool in the first 60 seconds will see the wrong tool count and a wrong test badge — both signal sloppy maintenance.

All four fixes are pure documentation changes, estimated 20-30 minutes total. No code changes required. Once fixed, this is a solid SHIP.

**Post-fix score estimate: 8.5/10 — SHIP.**
