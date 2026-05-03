# Dispatch Plan: Crawl + CLI + Skill (2026-04-28)

## Conflict Matrix
```
Worker 1 (crawl):  src/tools/crawl.ts (NEW)     → no conflict
Worker 2 (CLI):    src/cli.ts (NEW)              → no conflict
Worker 3 (SKILL):  skill/SKILL.md (NEW)          → no conflict
Integration:       src/index.ts, src/tools/index.ts, package.json → orchestrator only
```

## Worker 1 — novada_proxy_crawl

**File:** `src/tools/crawl.ts` (NEW)
**Prompt summary:** BFS recursive crawl, depth 1-5, limit 10-200, include_content option, reuse novadaProxyFetch, same-domain filtering, resource URL filtering, cache-aware credit tracking.
**Result:** Completed. Exports: novadaProxyCrawl, validateCrawlParams, CrawlParams, CrawlPageResult.

## Worker 2 — CLI

**File:** `src/cli.ts` (NEW)
**Prompt summary:** Node.js parseArgs (zero new deps), 8 subcommands mirroring tools, JSON output default, --human flag, error classification via classifyError.
**Result:** Completed. Required extracting classifyError to src/errors.ts (side effect issue).

## Worker 3 — SKILL.md

**File:** `skill/SKILL.md` (NEW)
**Prompt summary:** 167-line skill file, decision tree, tool reference, workflows, error recovery, cost guide. Under 200 lines.
**Result:** Completed.

## Integration (orchestrator)
- Added crawl to tools/index.ts exports
- Registered crawl tool in TOOLS array + dispatch handler in index.ts
- Added CLI bin entry to package.json
- Extracted classifyError to src/errors.ts (fix: cli.ts importing index.ts triggered MCP server startup side effects)
- Updated test imports (classifyError.test.ts, mcp.test.ts)

## ISSUES — Not Yet Done
- [ ] No tests for crawl tool
- [ ] No tests for CLI
- [ ] No reviewer pass on any of the 3 new files
- [ ] No verifier pass
- [ ] README not updated with crawl tool
- [ ] Skill not tested in Claude Code
