# Tool Description AEO Audit

Date: 2026-05-04

## Summary
- Tools audited: 10
- AEO score: 1/10 (how many meet all 7 criteria)
- Issues found: 13

## Per-Tool Audit

### novada_proxy_fetch
- Action verb: YES (`"Fetch any URL through residential proxy..."`)
- WHEN TO USE: YES (`"WHEN TO USE: Static/HTML pages, Amazon, LinkedIn, news sites, most commercial sites."`)
- USE X INSTEAD: YES (`"USE novada_proxy_render INSTEAD IF..."`, `"USE novada_proxy_extract INSTEAD IF..."`)
- ON FAILURE: YES (`"ON FAILURE: If error.code is BOT_DETECTION_SUSPECTED..."`)
- Token count: ~207
- Keywords: [residential proxy, 2M+ IPs, 195 countries, anti-bot bypass, country, city, session_id, cache]
- Schema descriptions: YES (missing: [])
- **Score: 6/7**
- **Suggestions:** Reduce the description below 200 tokens by tightening the return-shape and caching text. For example, keep the `WHEN TO USE`, `USE ... INSTEAD`, and `ON FAILURE` blocks, but compress `"Returns structured JSON with ok, data.content..."` and the long cache explanation.

### novada_proxy_batch_fetch
- Action verb: YES (`"Fetch multiple URLs concurrently through residential proxy."`)
- WHEN TO USE: YES (`"WHEN TO USE: Scraping lists of URLs from search results, product catalogs, competitor pages."`)
- USE X INSTEAD: YES (`"USE novada_proxy_fetch INSTEAD FOR: Single URLs — lower overhead."`)
- ON FAILURE: YES (`"ON FAILURE: Individual URL failures are captured in results[].error..."`)
- Token count: ~112
- Keywords: [multiple URLs, concurrently, residential proxy, scraping, search results, product catalogs]
- Schema descriptions: YES (missing: [])
- **Score: 7/7**
- **Suggestions:** None.

### novada_proxy_render
- Action verb: NO (`"[BETA] Render a JavaScript-heavy page..."` starts with metadata before the verb)
- WHEN TO USE: YES (`"WHEN TO USE: SPAs, React/Vue apps, infinite scroll, pages that require JS to load content."`)
- USE X INSTEAD: YES (`"USE novada_proxy_fetch INSTEAD FOR: Static HTML pages — it is 3-5x faster."`)
- ON FAILURE: YES (`"ON FAILURE: If error.code is TIMEOUT → increase timeout. If PROVIDER_NOT_CONFIGURED → set NOVADA_BROWSER_WS."`)
- Token count: ~110
- Keywords: [BETA, JavaScript-heavy, real Chromium, Novada Browser API, SPAs, React/Vue, infinite scroll]
- Schema descriptions: YES (missing: [])
- **Score: 6/7**
- **Suggestions:** Start with the action verb, e.g. `Render a JavaScript-heavy page with real Chromium [BETA]...`, so the first token reinforces tool selection.

### novada_proxy_search
- Action verb: NO (`"Structured web search via Google (Novada)."` is a noun phrase)
- WHEN TO USE: YES (`"WHEN TO USE: Finding pages by topic, factual queries, discovering URLs to then fetch."`)
- USE X INSTEAD: YES (`"USE novada_proxy_fetch INSTEAD FOR: Reading a specific URL you already have."`)
- ON FAILURE: YES (`"ON FAILURE: If error.code is PROVIDER_NOT_CONFIGURED → set NOVADA_API_KEY."`)
- Token count: ~101
- Keywords: [structured web search, Google, factual queries, discovering URLs]
- Schema descriptions: YES (missing: [])
- **Score: 6/7**
- **Suggestions:** Start with a verb such as `Search Google via Novada and return structured results...`.

### novada_proxy_extract
- Action verb: YES (`"Extract structured fields..."`)
- WHEN TO USE: YES (`"WHEN TO USE: Product pages, articles, listings where you need specific fields not raw content."`)
- USE X INSTEAD: YES (`"USE novada_proxy_fetch INSTEAD IF: You need full page content, not specific fields."`)
- ON FAILURE: YES (`"ON FAILURE without render_fallback: If TLS_ERROR or BOT_DETECTION_SUSPECTED → retry with render_fallback:true."`)
- Token count: ~251
- Keywords: [structured fields, residential proxy, Product pages, Open Graph, JSON-LD, render_fallback, TLS_ERROR, bot detection, LLM extraction]
- Schema descriptions: YES (missing: [])
- **Score: 6/7**
- **Suggestions:** Cut this below 200 tokens by moving the long `SCHEMA MODE` example into the `schema` field description or docs. Keep the core selection guidance and failure recovery in the tool description.

### novada_proxy_session
- Action verb: NO (`"Specialized wrapper around novada_proxy_fetch..."` is a noun phrase)
- WHEN TO USE: YES (`"WHEN TO USE: Multi-step workflows where IP consistency matters: login flows, paginated scraping, price monitoring."`)
- USE X INSTEAD: YES (`"For basic sticky routing without verification, use novada_proxy_fetch with a session_id parameter instead."`)
- ON FAILURE: YES (`"ON FAILURE: If SESSION_STICKINESS_FAILED → regenerate session_id or accept best-effort behavior."`)
- Token count: ~216
- Keywords: [sticky session, same residential IP, session_id, IP consistency, login flows, paginated scraping, price monitoring]
- Schema descriptions: NO (missing: [format])
- **Score: 4/7**
- **Suggestions:** Start with a verb such as `Fetch a URL with sticky-session verification...`; trim the repeated sticky-session notes below 200 tokens; add a `description` to the `format` schema property, which currently has only `type`, `enum`, and `default`.

### novada_proxy_map
- Action verb: YES (`"Crawl a URL and return all internal links..."`)
- WHEN TO USE: YES (`"WHEN TO USE: Before a batch scraping job..."`)
- USE X INSTEAD: YES (`"USE novada_proxy_fetch INSTEAD IF: You only need the content of a single specific URL."`)
- ON FAILURE: NO (no `ON FAILURE` guidance is present)
- Token count: ~127
- Keywords: [crawl, internal links, discovering pages, batch scraping, batch-fetching, shallow map, deep crawls]
- Schema descriptions: YES (missing: [])
- **Score: 6/7**
- **Suggestions:** Add a short recovery block, e.g. `ON FAILURE: If too few links are returned, retry with novada_proxy_render or crawl from the domain root.`

### novada_proxy_crawl
- Action verb: NO (`"Recursively crawl a website..."` starts with an adverb before the verb)
- WHEN TO USE: YES (`"WHEN TO USE: Full-site scraping, sitemap generation, content indexing..."`)
- USE X INSTEAD: YES (`"USE novada_proxy_map INSTEAD IF..."`, `"USE novada_proxy_batch_fetch INSTEAD IF..."`)
- ON FAILURE: NO (no `ON FAILURE` guidance is present)
- Token count: ~199
- Keywords: [recursively crawl, BFS traversal, full-site scraping, sitemap generation, content indexing, batch_fetch, cache]
- Schema descriptions: YES (missing: [])
- **Score: 5/7**
- **Suggestions:** Start with `Crawl a website recursively...` and add failure recovery for timeout, depth/limit overload, or sparse URL discovery. The current token count is just under the limit, so any new recovery text should replace or compress existing workflow/cache wording.

### novada_proxy_research
- Action verb: NO (`"One-shot deep research..."` is a noun phrase)
- WHEN TO USE: YES (`"WHEN TO USE: Research questions, topic investigation, competitive analysis, fact-finding."`)
- USE X INSTEAD: YES (`"USE novada_proxy_search INSTEAD IF..."`, `"USE novada_proxy_fetch INSTEAD IF..."`)
- ON FAILURE: YES (`"ON FAILURE: If PROVIDER_NOT_CONFIGURED → set NOVADA_API_KEY..."`)
- Token count: ~190
- Keywords: [deep research, searches the web, fetches top results, structured findings, sources, competitive analysis, fact-finding]
- Schema descriptions: YES (missing: [])
- **Score: 6/7**
- **Suggestions:** Start with a verb such as `Research a topic by searching the web and fetching top results...`. Keep the description under 200 tokens by shortening the parenthetical source-preview explanation.

### novada_proxy_status
- Action verb: YES (`"Check proxy connectivity and provider health."`)
- WHEN TO USE: YES (`"WHEN TO USE: Before starting a large scraping workflow, or to diagnose proxy failures."`)
- USE X INSTEAD: NO (no `USE ... INSTEAD` guidance is present)
- ON FAILURE: NO (no `ON FAILURE` guidance is present)
- Token count: ~94
- Keywords: [proxy connectivity, provider health, HEALTHY, DEGRADED, UNAVAILABLE, proxy_ip, live proxy call]
- Schema descriptions: YES (missing: [])
- **Score: 5/7**
- **Suggestions:** Add misuse prevention such as `USE novada_proxy_fetch INSTEAD IF you need to test a target URL` and recovery guidance for degraded/unavailable status, missing provider configuration, or failed httpbin connectivity.

## Overall Assessment
The tool descriptions are generally strong on `WHEN TO USE` guidance and most include explicit alternatives, which is the highest-impact AEO behavior for agent tool selection. The top priorities are to make every description start with a direct action verb, add `ON FAILURE` guidance to map/crawl/status, keep all descriptions under 200 tokens, and add the missing `format` schema description in `novada_proxy_session`.
