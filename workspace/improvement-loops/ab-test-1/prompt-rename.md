# A/B Test Round 1 — Rename agentproxy_* → novada_proxy_*

## Task
Rename ALL occurrences of the `agentproxy` naming convention to `novada_proxy` across the entire codebase. This is a comprehensive rename — tool names, function names, variable names, test references, docs, CLI, everything.

## Project
novada-proxy-mcp v1.8.1, MCP server for AI agents. TypeScript, ESM (.js imports), vitest.

## What to rename

### 1. Tool names (MCP tool identifiers)
In `src/index.ts` TOOLS array:
- `agentproxy_fetch` → `novada_proxy_fetch`
- `agentproxy_batch_fetch` → `novada_proxy_batch_fetch`
- `agentproxy_crawl` → `novada_proxy_crawl`
- `agentproxy_extract` → `novada_proxy_extract`
- `agentproxy_map` → `novada_proxy_map`
- `agentproxy_search` → `novada_proxy_search`
- `agentproxy_render` → `novada_proxy_render`
- `agentproxy_session` → `novada_proxy_session`
- `agentproxy_status` → `novada_proxy_status`

### 2. Function names
All exported functions across `src/tools/*.ts`:
- `agentproxyFetch` → `novadaProxyFetch`
- `agentproxyBatchFetch` → `novadaProxyBatchFetch`
- `agentproxyCrawl` → `novadaProxyCrawl`
- `agentproxyExtract` → `novadaProxyExtract`
- `agentproxyMap` → `novadaProxyMap`
- `agentproxySearch` → `novadaProxySearch`
- `agentproxyRender` → `novadaProxyRender`
- `agentproxySession` → `novadaProxySession`
- `agentproxyStatus` → `novadaProxyStatus`

### 3. All references to old names
- `src/index.ts` — tool dispatch switch/case, tool response `tool:` field
- `src/cli.ts` — CLI dispatch, help text
- `src/tools/batch.ts` — calls agentproxyFetch internally
- `src/tools/crawl.ts` — calls agentproxyFetch internally
- `src/tools/extract.ts` — calls agentproxyFetch internally
- `src/tools/session.ts` — calls agentproxyFetch internally
- `src/tools/map.ts` — calls agentproxyFetch internally
- All `src/__tests__/*.ts` files — function imports, tool name assertions
- `README.md` — all tool name references (both English and Chinese sections)
- `clawhub/proxy4agent/SKILL.md` — tool references
- `smithery.yaml` — if it references tool names

### 4. Tool descriptions
Inside tool descriptions in TOOLS array, update:
- Any "agentproxy_*" references (like "USE agentproxy_fetch INSTEAD")
- CHAIN WITH hints (like "CHAIN WITH: agentproxy_batch_fetch")

### 5. MCP prompts and resources
- Prompt templates that reference tool names
- Resource content that references tool names
- The `tool:` field in all response objects

## Rules
- Run `npm run build && npm test` after ALL changes
- ALL tests must pass (currently 364)
- Do NOT change any logic — this is a pure rename
- Do NOT change file names — only content
- Do NOT skip any file — grep for "agentproxy" and ensure zero matches when done
- Final check: `grep -r "agentproxy" src/ README.md clawhub/ smithery.yaml` should return ZERO results
