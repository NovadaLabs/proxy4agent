# Loop 1 Summary — Audit Results

## Scores

| Review | Score | Lowest Area |
|--------|:-----:|-------------|
| Architecture | 7.8/10 | Naming (6/10), Code structure (7/10), Cache (7/10) |
| Agent UX | 8.4/10 | Naming (6.5/10), Prompts (7.5/10) |
| Competitive | 42/60 | Content quality (5/10), Setup friction (6/10), Tool coverage (7/10) |

## Cross-Cutting Findings (sorted by severity)

### CRITICAL — Fix in Loop 2
| # | Issue | Source | Impact |
|---|-------|--------|--------|
| C1 | **Naming: 5 different conventions** — `agentproxy_*`, `novada-proxy-mcp`, `proxy4agent`, `PROXY4AGENT_*`, `NOVADA_*` | Arch + UX | Agents can't find tools by product name |
| C2 | **Credential redaction duplicated 4x** — index.ts (2x), cli.ts, batch.ts | Arch | Bug in one copy = credential leak |
| C3 | **Tool dispatch duplicated** — index.ts + cli.ts maintain parallel switch/case | Arch | Adding a tool requires 4 files |
| C4 | **index.ts is 890-line monolith** — schemas, prompts, resources, CLI, startup all in one file | Arch | Hard to maintain, review, extend |

### HIGH — Fix in Loop 2-3
| # | Issue | Source | Impact |
|---|-------|--------|--------|
| H1 | **No handler tests** for map, search, session, render | Arch | Logic bugs go undetected |
| H2 | **No CHAIN WITH hints** in tool descriptions | UX | Agents don't know optimal pipelines |
| H3 | **map vs crawl verb collision** — map description says "Crawl a URL" | UX | 50% agent selection failure on discovery tasks |
| H4 | **No `data.urls` convenience field** in crawl/search responses | UX | Agents must manually extract URLs to chain |
| H5 | **String-based INVALID_INPUT detection** — fragile substring matching in classifyError | Arch | New validation messages fall through to UNKNOWN_ERROR |

### MEDIUM — Fix in Loop 3
| # | Issue | Source | Impact |
|---|-------|--------|--------|
| M1 | **Cache lacks in-flight deduplication** — concurrent same-URL requests both pay credits | Arch | Wasted proxy credits |
| M2 | **meta.quota.note is noise** — 15 tokens wasted per response | UX | Token waste across all calls |
| M3 | **`num` vs `limit` inconsistency** — search uses `num`, others use `limit` | UX | Agent passes wrong param name |
| M4 | **Content quality is basic** — no readability/noise removal | Competitive | Score 5/10 vs Firecrawl's 9/10 |
| M5 | **PROXY4AGENT_* env vars** — legacy prefix doesn't match product name | Arch + UX | Confusing for setup |

### Competitive Gaps (product decisions, not code fixes)
| # | Gap | Priority | Action |
|---|-----|----------|--------|
| G1 | No LLM-powered extraction | P0 May | Needs LLM API integration decision |
| G2 | No research tool | P1 June | New feature design |
| G3 | No remote MCP server | P0 May | Infrastructure (mcp.novada.com) |
| G4 | 176x download gap | P0 May | Distribution, not code |

## Loop 2 Plan

**Scope:** Fix C1-C4, H1-H5 (9 code-quality issues)

**Execution strategy:**
- Spawn implementation workers in parallel for independent changes
- Cross-review: each worker's output reviewed by a fresh agent
- Verify: build + all tests pass after each fix

### Fix Groups (parallelizable)

**Group A: Structural refactoring** (C2, C3, C4)
1. Extract credential redaction → `src/redact.ts`
2. Create tool registry → `src/tools/registry.ts`
3. Split index.ts → `src/prompts.ts`, `src/resources.ts`, `src/schemas.ts`

**Group B: Type safety + error handling** (H5)
1. Create `InputValidationError` class
2. Update all validators to throw it
3. Update `classifyError` to use `instanceof`

**Group C: Agent UX improvements** (H2, H3, H4, M2, M3)
1. Add CHAIN WITH hints to tool descriptions
2. Fix map description ("Crawl a URL" → "Scan a single page")
3. Add `data.urls` to crawl and search responses
4. Remove `meta.quota.note` from responses
5. Rename `num` → `limit` in search (keep `num` as alias)

**Group D: Naming unification** (C1, M5)
1. Rename env vars: `PROXY4AGENT_*` → `NOVADA_PROXY_*` (keep old as fallback)
2. Add `novada_proxy_*` tool aliases alongside `agentproxy_*`
3. Console deprecation notice when old names used

**Group E: Test coverage** (H1)
1. Add handler tests for map, search, session, render
2. Add prompt/resource snapshot tests

**Group F: Cache improvement** (M1)
1. Add in-flight request deduplication map
