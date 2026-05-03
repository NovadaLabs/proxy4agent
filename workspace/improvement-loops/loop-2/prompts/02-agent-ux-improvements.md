# Loop 2 — Agent 2: Agent UX Improvements

## Role
You are an MCP tool designer improving the agent-facing surface of novada-proxy-mcp. Every change you make should help an AI agent use these tools more effectively on the first try.

## Project
`/Users/tongwu/Projects/agentproxy/` — novada-proxy-mcp v1.8.1, MCP server for AI agents.

## Fixes to Implement (in order)

### Fix 1: Fix map tool description
**File:** `src/index.ts` — find the `agentproxy_map` tool definition in the TOOLS array.
**What:** The current description starts with "Crawl a URL and return all internal links found on a page." This uses the word "crawl" which collides with `agentproxy_crawl`. Change it to:
"Scan a single page and return all links found on it. Fast single-page link discovery — does NOT follow links to other pages."
Keep the rest of the description (WHEN TO USE, USE INSTEAD, ON FAILURE sections) but update any references that say "crawl" to say "scan" where appropriate.

### Fix 2: Add CHAIN WITH hints to discovery tool descriptions
**File:** `src/index.ts` — tool descriptions in the TOOLS array.
**What:** Add a `CHAIN WITH:` line to these tools' descriptions:

For `agentproxy_map`:
Add after the main description: `"CHAIN WITH: agentproxy_batch_fetch to scrape all discovered URLs in parallel."`

For `agentproxy_crawl`:
Add: `"CHAIN WITH: agentproxy_batch_fetch to scrape specific pages from the URL tree. If include_content=true, content is already inline — no need for batch_fetch."`

For `agentproxy_search`:
Add: `"CHAIN WITH: agentproxy_batch_fetch to read all search result URLs in parallel."`

For `agentproxy_extract`:
Add: `"CHAIN WITH: agentproxy_fetch first if you need both raw content AND structured fields."`

Place the CHAIN WITH line right before the ON FAILURE section (or at the end of the main description if no ON FAILURE section exists).

### Fix 3: Add `data.urls` convenience field to crawl response
**File:** `src/tools/crawl.ts`
**What:** In the response object construction (where `data.pages` is built), add a `urls` field that is a flat string array of all page URLs:
```typescript
data: {
  pages_crawled: ...,
  pages: ...,
  urls: pages.map(p => p.url),  // convenience field for chaining to batch_fetch
  ...
}
```
This lets agents pass `data.urls` directly to `agentproxy_batch_fetch` without manually extracting from `data.pages`.

### Fix 4: Add `data.urls` convenience field to search response
**File:** `src/tools/search.ts`
**What:** In the response object construction, add a `urls` field:
```typescript
data: {
  results: ...,
  urls: results.map(r => r.url || r.link),  // convenience field for chaining to batch_fetch
  ...
}
```
Check the actual field name used in search results (might be `url` or `link` or `href`).

### Fix 5: Remove `meta.quota.note` from all responses
**Files:** All files in `src/tools/` that include `meta.quota.note` or reference `QUOTA_NOTE`.
**What:** Remove the `note` field from the `meta.quota` object in all response constructions. The constant `QUOTA_NOTE` in `src/validation.ts` can stay (it might be used elsewhere) but should not appear in API responses. This saves ~15 tokens per response.

Check these files: `fetch.ts`, `batch.ts`, `crawl.ts`, `extract.ts`, `search.ts`, `render.ts`, `session.ts`.

Remove the `note` property from the response objects but keep `credits_estimated`.

### Fix 6: Standardize `num` → `limit` in search
**File:** `src/tools/search.ts` and `src/index.ts` (search tool schema)
**What:**
1. In the search tool input schema (in index.ts TOOLS array), rename the `num` parameter to `limit`. Keep the same description and default.
2. In `validateSearchParams` (search.ts), accept BOTH `limit` and `num` (for backwards compatibility), preferring `limit`:
```typescript
const limit = raw.limit !== undefined ? Number(raw.limit) : (raw.num !== undefined ? Number(raw.num) : 10);
```
3. In the handler function, use `limit` consistently.

### Fix 7: Rename PROXY4AGENT_* env vars to NOVADA_PROXY_*
**Files:** `src/tools/fetch.ts` (cache TTL), `src/tools/render.ts` (max renders), any other files using `PROXY4AGENT_*`.
**What:** Change env var names:
- `PROXY4AGENT_CACHE_TTL_SECONDS` → `NOVADA_PROXY_CACHE_TTL`
- `PROXY4AGENT_MAX_RENDERS` → `NOVADA_PROXY_MAX_RENDERS`

Keep the old names as fallbacks:
```typescript
const ttl = Number(process.env.NOVADA_PROXY_CACHE_TTL ?? process.env.PROXY4AGENT_CACHE_TTL_SECONDS ?? 300);
```

Update any comments or console.log messages that reference the old env var names.

## Rules
- Run `npm run build && npm test` after ALL changes to verify nothing breaks.
- Do NOT change internal function names or file structure.
- Do NOT add new tools or remove existing tools.
- Do NOT change tool names (keep `agentproxy_*` prefix — rename is a separate task).
- Preserve all existing tests. Update test assertions if response format changes (e.g., removing quota.note).
- Import paths must use `.js` extension (ESM project).
