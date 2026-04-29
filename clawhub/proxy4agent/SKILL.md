---
name: novada-proxy
description: Residential proxy MCP server for AI agents — 9 tools to fetch, crawl, batch, extract, map, search, render through 2M+ real IPs. Bypass Cloudflare/Akamai, geo-target 195+ countries, sticky sessions, response cache. Multi-provider (Novada, BrightData, Smartproxy, Oxylabs).
version: 1.8.1
metadata:
  openclaw:
    requires:
      anyBins: [node, npx]
    primaryEnv: NOVADA_PROXY_USER
    always: false
    homepage: https://github.com/NovadaLabs/Novada-proxy
    os: [macos, linux, windows]
    install:
      - kind: node
        formula: novada-proxy-mcp@1.8.1
        bins: [novada-proxy-mcp, novada-proxy]
---

# Novada Proxy

Residential proxy MCP server for AI agents. Route HTTP requests through 2M+ real home devices to bypass anti-bot systems, geo-target by country or city, maintain sticky sessions, and cache responses to save proxy credits.

**npm:** `novada-proxy-mcp` | **GitHub:** [NovadaLabs/Novada-proxy](https://github.com/NovadaLabs/Novada-proxy)

## Setup

You only need credentials for ONE provider. Novada is the default and recommended provider.

### Novada (recommended)

```bash
claude mcp add novada-proxy-mcp \
  -e NOVADA_PROXY_USER=your_username \
  -e NOVADA_PROXY_PASS=your_password \
  -- npx -y novada-proxy-mcp
```

Get credentials: [novada.com](https://www.novada.com) → Dashboard → Residential Proxies (free tier, no credit card).

### Any HTTP proxy (BrightData, Smartproxy, Oxylabs, IPRoyal...)

```bash
claude mcp add novada-proxy-mcp \
  -e PROXY_URL="http://user:pass@host:port" \
  -- npx -y novada-proxy-mcp
```

### Optional credentials

- `NOVADA_API_KEY` — enables `agentproxy_search` (Google search)
- `NOVADA_BROWSER_WS` — enables `agentproxy_render` (JS rendering via real Chromium)
- `NOVADA_PROXY_ZONE` — proxy type: `res` (residential, default), `isp` (rotating ISP), `dcp` (datacenter)

## When to use which tool

```
Scrape a single URL         → agentproxy_fetch
Need structured fields      → agentproxy_extract
Scrape 2-20 URLs at once    → agentproxy_batch_fetch
Discover URLs on a page     → agentproxy_map → agentproxy_batch_fetch
Crawl a whole site          → agentproxy_crawl (recursive BFS, depth 1-5)
Login + multi-page flow     → agentproxy_session (same session_id)
Search the web              → agentproxy_search
JS-heavy SPA / blank page   → agentproxy_render
Check proxy health          → agentproxy_status
```

## 9 Tools

### agentproxy_fetch
Fetch any URL through a residential proxy. Returns structured JSON with content, status, and metadata. Responses are cached 300s by default — repeated calls cost zero credits (`meta.cache_hit: true`).

Parameters: `url` (required), `country`, `city`, `session_id`, `format` (markdown/raw), `timeout` (1-120s)

### agentproxy_batch_fetch
Fetch 2-20 URLs concurrently. Up to 5x faster than sequential calls. Per-item errors are captured individually.

Parameters: `urls` (2-20, required), `concurrency` (1-5, default 3), `country`, `format`, `timeout`

### agentproxy_crawl
Recursively crawl a website via BFS. Discovers internal links at each depth level, deduplicates, and returns the full URL tree with metadata.

Parameters: `url` (required), `depth` (1-5, default 2), `limit` (10-200, default 50), `include_content` (boolean), `country`, `format`, `timeout`

### agentproxy_extract
Extract structured fields from any URL using heuristic pattern matching (meta tags, Open Graph, JSON-LD, `<img>` fallback, relative URL resolution). Set `render_fallback: true` to auto-retry via Chromium if blocked.

Parameters: `url` (required), `fields` (required array), `render_fallback`, `country`, `timeout`

### agentproxy_map
Discover all internal links on a single page. Use as the discovery step before `agentproxy_batch_fetch`.

Parameters: `url` (required), `limit` (10-200, default 50), `include_external`, `country`, `timeout`

### agentproxy_session
Sticky session — same IP across all calls with the same `session_id`. Use for login flows, paginated scraping, price monitoring.

Parameters: `session_id` (required), `url` (required), `country`, `city`, `verify_sticky`, `format`, `timeout`

### agentproxy_search
Structured Google search via Novada Scraper API. Returns titles, URLs, and snippets as clean JSON.

Requires: `NOVADA_API_KEY`

### agentproxy_render [BETA]
Render JavaScript-heavy pages using real Chromium. Use for SPAs, React/Vue apps.

Requires: `NOVADA_BROWSER_WS` | ~5 proxy credits per call

### agentproxy_status
Check proxy network connectivity, provider, and version.

## Error codes

Every error includes `code`, `recoverable`, and `agent_instruction`:

| Code | Meaning | Action |
|------|---------|--------|
| `BOT_DETECTION_SUSPECTED` | 4xx — target blocked | Retry with `agentproxy_render` or different `country`. If render also fails, page may not exist. |
| `TLS_ERROR` | TLS/SSL failed | Retry with different `country`. May be DNS issue for unknown domains. |
| `TIMEOUT` | Request timed out | Increase `timeout` or retry |
| `RATE_LIMITED` | HTTP 429 | Wait 5s and retry |
| `NETWORK_ERROR` | DNS failure | Verify URL is correct |
| `INVALID_INPUT` | Bad parameter | Fix parameter and retry |
| `PROVIDER_NOT_CONFIGURED` | Missing env vars | Set credentials and restart |

## Support

Contact [support@novada.com](mailto:support@novada.com) for help with credentials, proxy configuration, or API access.
