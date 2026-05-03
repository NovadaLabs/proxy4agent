# Loop 2 — Agent 1: Internal Code Quality Fixes

## Role
You are a senior TypeScript engineer fixing specific code quality issues identified in a code review. You make surgical, targeted changes — no scope creep.

## Project
`/Users/tongwu/Projects/agentproxy/` — novada-proxy-mcp v1.8.1, MCP server for AI agents.

## Fixes to Implement (in order)

### Fix 1: Create InputValidationError class
**File:** `src/errors.ts`
**What:** Add a typed error class for input validation failures.
```typescript
export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputValidationError";
  }
}
```
Then update `classifyError` to detect it via `instanceof InputValidationError` INSTEAD of the fragile substring matching on line ~43-48 (the `"is required"`, `"must be"`, `"must start with"` checks). Keep the substring matching as a fallback for non-InputValidationError errors.

### Fix 2: Update all validators to throw InputValidationError
**Files:** `src/tools/fetch.ts`, `src/tools/batch.ts`, `src/tools/crawl.ts`, `src/tools/extract.ts`, `src/tools/search.ts`, `src/tools/render.ts`, `src/tools/session.ts`, and any other files with `validate*Params` functions.
**What:** Change every `throw new Error(...)` in validation functions to `throw new InputValidationError(...)`.
Import from `../errors.js`.

### Fix 3: Extract credential redaction into shared function
**New file:** `src/redact.ts`
**What:** Create a shared `redactCredentials` function that replaces credential values in error messages. Currently this logic is copy-pasted in 4 places:
- `src/index.ts` (around lines 341-365)
- `src/index.ts` (around lines 865-887)
- `src/cli.ts` (around lines 37-62)
- `src/tools/batch.ts` (around lines 92-102)

The function signature should be:
```typescript
export function redactCredentials(
  message: string,
  adapter: ProxyAdapter,
  credentials: ProxyCredentials
): string
```

It should:
1. Iterate adapter.sensitiveFields, replace raw + encodeURIComponent values
2. Also redact credentials["user"] if present
3. Also redact process.env.NOVADA_API_KEY and process.env.NOVADA_BROWSER_WS if present
4. Return the redacted message

Then update ALL 4 locations to use this shared function.

### Fix 4: Add in-flight request deduplication to cache
**File:** `src/tools/fetch.ts`
**What:** Add a `Map<string, Promise<string>>` called `_inflightRequests` alongside `_responseCache`. Before making a network call, check if another request for the same cache key is already in flight. If so, await and return the existing promise. This prevents duplicate proxy credit charges for concurrent identical requests.

Key implementation points:
- Create the inflight map at module level (next to _responseCache)
- In agentproxyFetch, after cache-miss check, look up inflightRequests
- If found, await it and return (the awaited result will have cache_hit info)
- If not found, store the promise, execute, then delete from inflight map on completion
- Session-pinned requests (with session_id) should bypass inflight dedup just like they bypass cache
- Use try/finally to ensure cleanup on errors

## Rules
- Run `npm run build && npm test` after ALL changes to verify nothing breaks.
- Do NOT change any tool names, descriptions, or response formats.
- Do NOT add features. Only fix the specific issues listed.
- Do NOT refactor anything not explicitly mentioned.
- Import paths must use `.js` extension (ESM project).
- Preserve all existing functionality exactly.
