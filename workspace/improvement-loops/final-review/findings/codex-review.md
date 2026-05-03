# Final Product Review — novada-proxy-mcp (Codex)

## Overall Score: 7.1/10

## Ship Recommendation: HOLD

This is close to shippable as a developer-facing MCP package, but I would not publish this exact state. The implementation is substantially better than the release metadata: build passes, tests pass, 10 MCP tools are registered, response envelopes are mostly consistent, validation exists, and credential redaction is present. The blocker is product trust: README/changelog/version/tool-name drift is visible, and the "deep research" and "schema extraction" claims overstate what the code actually does.

## Dimension Scores (table)

| Dimension | Score | Evidence |
|---|---:|---|
| Completeness — full lifecycle, all tools functional | 8 | `src/index.ts` registers 10 tools: `novada_proxy_fetch`, `batch_fetch`, `render`, `search`, `extract`, `session`, `map`, `crawl`, `research`, `status` at lines 63-214, with matching switch cases at lines 252-348. `npm test` passed 430 tests across 15 files. |
| Consistency — naming, format, errors, docs=code | 5 | `agentproxy` occurs 0 times in `src/`, `README.md`, `clawhub/`, `smithery.yaml`, but `CHANGELOG.md` still uses old `agentproxy_*` names and claims v1.9.0 while `package.json` is v1.8.1. README says 10 tools, but top nav links to `#9-tools-at-a-glance`. CLI help in `src/index.ts` lines 880-885 lists only 6 tools. |
| Content Quality — markdown, noise removal, schema extraction | 7 | `src/tools/fetch.ts` converts HTML to markdown, computes `content_density`, truncates large pages, handles gzip/br/deflate, and caches. `src/tools/extract.ts` supports JSON-LD, Open Graph/meta tags, basic tag extraction, links, images, headings, and price heuristics. But schema mode does not extract structured data server-side; it returns content plus `extraction_prompt` for the caller LLM. |
| Competitive Position — vs Firecrawl, Tavily, BrightData | 6 | Strong differentiator: agent-oriented residential proxy tools with sticky sessions and multi-provider adapters. Weaker than Firecrawl MCP for polished crawl/scrape/extract lifecycle, weaker than Tavily MCP for search/research quality, and weaker than BrightData MCP for mature browser/data infrastructure. Competitive comparison is based on general product knowledge, not externally re-verified in this run. |
| Agent UX — LLM first-try success | 8 | Tool descriptions in `src/index.ts` include WHEN TO USE / USE INSTEAD / ON FAILURE guidance. Errors include `agent_instruction` via `src/errors.ts`, and missing credential errors give exact setup commands. JSON envelopes are consistent on success: grep found `tool:` in every `src/tools/*.ts` module. |
| Security — schema validation, credential redaction | 8 | Validators constrain URL schemes, country/city/session IDs, schemas, timeouts, field counts, query length, and concurrency (`src/validation.ts`, `src/tools/extract.ts`, `src/tools/research.ts`). `src/index.ts` lines 370-393 redacts provider credentials, usernames, `NOVADA_API_KEY`, and `NOVADA_BROWSER_WS` from error messages. |
| Documentation — README accuracy, bilingual | 6 | README is rich and bilingual, with install instructions, tool table, prompts, resources, workflows, errors, and Chinese docs. Accuracy problems remain: stale 320-test badge versus 430 actual tests, stale "9 tools" anchor, status says requires none while resource guide says status costs 1 credit and code performs live proxy verification when configured, and detailed tool docs later omit `crawl`/`research` sections from the English tool reference. |
| Ship Readiness — build, tests, version, changelog | 9 for code, 5 for release hygiene | `npm run build` passed. `npm test` tail: `Test Files 15 passed (15)`, `Tests 430 passed (430)`. Package version is `1.8.1`; `src/config.ts` also exports `VERSION = "1.8.1"`. `CHANGELOG.md` starts with `v1.9.0 (2026-04-13)`, which is a publish-blocking release metadata inconsistency. |

## Critical Issues (must fix)

1. Release metadata is internally inconsistent. `package.json` and `src/config.ts` say `1.8.1`, while `CHANGELOG.md` starts with `v1.9.0 (2026-04-13)`. A developer evaluating adoption will see this as sloppy release discipline.

2. Changelog uses obsolete product/tool names. The first 50 lines of `CHANGELOG.md` repeatedly document `agentproxy_batch_fetch`, `agentproxy_fetch`, `agentproxy_search`, etc., while the current code and README use `novada_proxy_*`. This undermines confidence in migration history and registry readiness.

3. README overstates schema extraction. `src/tools/extract.ts` schema mode returns `mode: "llm_extract"`, cleaned `content`, and an `extraction_prompt`; it does not itself return extracted schema values. The README/tool description should make that unmistakable.

4. README overstates research synthesis. `src/tools/research.ts` performs search, fetch, first-500-character previews, and heuristic concatenation. It is useful, but "deep research" and "synthesize" read stronger than the actual implementation.

## Important Issues (should fix)

1. Update README test count. README badges claim 320 tests; actual `npm test` reports 430 passed.

2. Fix README navigation and tool reference drift. The top nav links to `#9-tools-at-a-glance` even though the section is `10 Tools at a Glance`. The English detailed tool reference covers `fetch`, `batch_fetch`, `extract`, `map`, `session`, `search`, `render`, and `status`, but not detailed sections for `crawl` and `research`.

3. Update CLI help exposed from `src/index.ts` lines 880-885. It lists only six tools and omits `batch_fetch`, `map`, `crawl`, and `research`.

4. Clarify `novada_proxy_status` cost/requirements. README table says status requires none, which is true in the sense that it returns `"none configured"` without credentials. But `src/tools/status.ts` performs a live proxied `httpbin.org/ip` call when credentials exist and reports `credits_estimated: 1`. Docs should separate "can run without credentials" from "live verification may cost a proxy call."

5. Consider returning `tool` in error envelopes. Success responses include `tool`, but `ProxyErrorResponse` only has `{ok:false,error}`. The current format is workable, but per-tool errors are less self-describing in logs and multi-call agent traces.

6. Improve extraction robustness before calling it high-quality content extraction. Regex-based HTML parsing, first plausible price, shallow JSON-LD search, and 50-link caps are acceptable for lightweight heuristics, but not comparable to mature extraction APIs.

## Competitive Verdict

novada-proxy-mcp has a credible niche: residential proxy access packaged for AI agents, with sticky sessions, country/city targeting, batch fetch, crawl/map, render fallback, search, and structured JSON responses. That is a useful developer product.

Against Firecrawl MCP, this is less polished for scraping lifecycle and extraction. Firecrawl is usually the better choice when the developer wants crawl/scrape/map/extract as the primary product and expects mature markdown conversion and structured extraction.

Against Tavily MCP, this is weaker for search and research. Tavily is purpose-built for search/retrieval/research workflows; `novada_proxy_research` is mostly search plus fetched previews plus heuristic source notes.

Against BrightData MCP, this is weaker for enterprise-grade scraping infrastructure and browser/data APIs, but easier to understand as an agent-first MCP wrapper if the developer specifically wants proxy routing and simple tools.

The best positioning is not "better Firecrawl" or "better Tavily." It is "agent-first residential proxy toolkit with optional search/render/extract helpers."

## Ship Decision Rationale

I would hold publication until the release hygiene and docs drift are fixed. The codebase itself is in decent shape: build passes, tests pass, validation is meaningful, responses are machine-readable, and error instructions are agent-friendly. But publishing with a stale changelog, mismatched version, stale tool names, outdated test badge, incomplete CLI help, and overstated schema/research claims will reduce developer trust immediately.

Once those are fixed, this is publishable. It will not beat specialist tools on extraction or search quality, but it can be a solid MCP for agents that need proxy-backed fetching, geo-targeting, sticky sessions, and a practical crawl/search/fetch workflow.
