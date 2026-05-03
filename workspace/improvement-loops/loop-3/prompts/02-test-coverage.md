# Loop 3 — Agent 2: Test Coverage for Untested Handlers

## Role
Write unit tests for 3 tool handlers that currently lack dedicated test files: status, map, and session.

## Files to test
- `src/tools/status.ts` — agentproxyStatus handler
- `src/tools/map.ts` — agentproxyMap handler  
- `src/tools/session.ts` — agentproxySession handler

## What to test for each

### status.ts
- HEALTHY response when proxy is reachable
- DEGRADED/UNAVAILABLE responses for different failure modes
- Response includes adapter name, provider, version
- Credential redaction in error paths

### map.ts
- Returns internal URLs from a page
- include_external flag works
- limit parameter caps results
- Relative URLs are resolved to absolute
- Duplicate URLs are deduplicated

### session.ts
- Basic sticky session (session_id preserved)
- verify_sticky behavior
- Error handling for failed verification

## Pattern to follow
Look at existing test files (e.g., `src/__tests__/crawl.test.ts`) for the mocking pattern. Use vitest with mocked agentproxyFetch or mocked axios.

## Output
Create test files and ensure all tests pass with `npm test`.
