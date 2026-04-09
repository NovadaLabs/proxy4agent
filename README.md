# ProxyVeil

Residential proxy MCP server for AI agents — fetch any URL through 2M+ residential IPs, bypass anti-bot systems, render JS-heavy pages, geo-target by country or city, maintain sticky sessions.

[![npm](https://img.shields.io/npm/v/proxy-veil?label=npm&color=CB3837)](https://npmjs.com/package/proxy-veil)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Powered by **[Novada](https://www.novada.com)** — sign up once, all tools from one account.

## Get Your Credentials

1. Sign up at **[novada.com](https://www.novada.com)** — 30 seconds, no credit card
2. From your dashboard, get the credentials for each tool you need:

| Tool | Required env vars | Where to get them |
|------|-------------------|-------------------|
| `agentproxy_fetch` | `NOVADA_PROXY_USER` + `NOVADA_PROXY_PASS` | Dashboard → Residential Proxies → Endpoint Generator |
| `agentproxy_session` | `NOVADA_PROXY_USER` + `NOVADA_PROXY_PASS` | Dashboard → Residential Proxies → Endpoint Generator |
| `agentproxy_search` | `NOVADA_API_KEY` | Dashboard → API Keys |
| `agentproxy_render` [BETA] | `NOVADA_BROWSER_WS` | Dashboard → Browser API → Playground → copy Puppeteer URL |
| `agentproxy_status` | _(none)_ | — |

You don't need all of them — only set what you use.

## Install

**Search only:**
```bash
claude mcp add proxy-veil \
  -e NOVADA_API_KEY=your_key \
  -- npx -y proxy-veil
```

**Fetch + Session (full proxy network):**
```bash
claude mcp add proxy-veil \
  -e NOVADA_PROXY_USER=your_username \
  -e NOVADA_PROXY_PASS=your_password \
  -e NOVADA_PROXY_HOST=your_account_host \
  -- npx -y proxy-veil
```

**All tools:**
```bash
claude mcp add proxy-veil \
  -e NOVADA_API_KEY=your_key \
  -e NOVADA_PROXY_USER=your_username \
  -e NOVADA_PROXY_PASS=your_password \
  -e NOVADA_PROXY_HOST=your_account_host \
  -- npx -y proxy-veil
```

> `NOVADA_PROXY_HOST` is your account-specific proxy host from the Endpoint Generator (e.g. `abc123.vtv.na.novada.pro`). Required for reliable sticky sessions.

## Why ProxyVeil

AI agents get blocked on 60–70% of commercial websites with standard HTTP requests. AgentProxy routes through real home devices — Android phones, Windows PCs, Macs — so your agent looks like a real user.

| Problem | AgentProxy |
|---------|-----------|
| Amazon, LinkedIn block your agent | Residential IPs from real devices |
| Cloudflare / Akamai challenges | Bypassed via real device fingerprints |
| JS-rendered pages show blank | Browser API runs real Chromium |
| Geo-restricted content | 195+ countries, city-level targeting |
| Multi-step workflows need same IP | Sticky sessions — same IP across calls |
| Need structured search results | Built-in Google search via Novada |

## Tools

### `agentproxy_fetch`
Fetch any URL through Novada's residential proxy. Works on Amazon, LinkedIn, Cloudflare-protected pages, and most commercial sites.

**Requires:** `NOVADA_PROXY_USER` + `NOVADA_PROXY_PASS`

```
url        — Target URL (required, http/https only)
country    — 2-letter code: US, DE, JP, GB, BR, ... (195+ countries)
city       — City-level: newyork, london, tokyo, ...
session_id — Reuse same ID to keep the same IP (letters/numbers/underscores, no hyphens)
format     — "markdown" (default) | "raw"
timeout    — Seconds, 1-120 (default 60)
```

### `agentproxy_render` [BETA]
Render JavaScript-heavy pages using Novada's Browser API (real Chromium). Use this for SPAs, React/Vue apps, and sites that need JS to load content.

**Requires:** `NOVADA_BROWSER_WS` (copy the Puppeteer/Playwright URL from Dashboard → Browser API → Playground)

```
url       — Target URL (required)
format    — "markdown" (default) | "html" | "text"
wait_for  — CSS selector to wait for before extracting (e.g. ".product-title")
timeout   — Seconds, 5-120 (default 60)
```

### `agentproxy_search`
Structured web search via Novada. Returns clean titles, URLs, descriptions — no HTML parsing needed.

**Requires:** `NOVADA_API_KEY`

```
query    — Search query (required)
num      — Results count, 1-20 (default 10)
country  — Localize results (e.g. us, uk, de)
language — Language code (e.g. en, zh, de)
```

### `agentproxy_session`
Sticky session fetch — every call with the same `session_id` uses the same residential IP. For login flows, paginated scraping, price monitoring.

**Requires:** `NOVADA_PROXY_USER` + `NOVADA_PROXY_PASS`

```
session_id — Unique session ID, no hyphens (required)
url        — Target URL (required)
country    — 2-letter country code
format     — "markdown" | "raw"
timeout    — Seconds, 1-120
```

### `agentproxy_status`
Check Novada's proxy network health — node count, device breakdown, service status.

## Real-World Results

These are live outputs captured from actual API calls — not fabricated.

### Geo-targeting: same URL, different countries
```
agentproxy_fetch(url="https://httpbin.org/ip", country="US", format="raw")
→ { "origin": "200.50.235.236" }   ← US residential IP

agentproxy_fetch(url="https://httpbin.org/ip", country="JP", format="raw")
→ { "origin": "60.85.57.175" }     ← Japan residential IP
```

### Sticky session: same IP across requests
```
agentproxy_session(session_id="job001", url="https://httpbin.org/ip", format="raw")
→ { "origin": "103.135.135.168" }

agentproxy_session(session_id="job001", url="https://httpbin.org/ip", format="raw")
→ { "origin": "103.135.135.168" }  ← same IP, confirmed
```

### Amazon product page — bypassed, 1.6 MB extracted
```
agentproxy_fetch(url="https://www.amazon.com/dp/B0BSHF7WHW", country="US")
→ [URL: https://www.amazon.com/dp/B0BSHF7WHW | Status: 200 | Size: 1637 KB | Country: US]

  Apple 2023 MacBook Pro — M2 Pro, 16-inch, 16GB, 1TB
  (full product page including price, reviews, specs)
```

### HackerNews front page — full content, 34 KB
```
agentproxy_fetch(url="https://news.ycombinator.com")
→ [URL: https://news.ycombinator.com | Status: 200 | Size: 34 KB]

  1. LittleSnitch for Linux — 752 points, 243 comments
  2. I ported Mac OS X to the Nintendo Wii — 1590 points, 281 comments
  3. Git commands I run before reading any code — 2054 points, 445 comments
  ...30 stories extracted as clean markdown
```

### Web search — structured results, no HTML parsing
```
agentproxy_search(query="residential proxy for AI agents", num=3)
→ Search: "residential proxy for AI agents" via GOOGLE — 3 results

  1. Residential Proxies Trusted by Fortune 500 Companies
     https://brightdata.com/proxy-types/residential-proxies
     Access 400M+ residential proxies from 195 countries...

  2. Proxies for AI Web Agents: The Complete Guide
     https://netnut.io/proxies-for-ai-web-agents/
     Real-user IPs that bypass even the toughest anti-bot systems...
```

## Example: Agent Price Monitor

```python
# Check Amazon price across three markets
agentproxy_fetch(url="https://amazon.com/dp/B0BSHF7WHW", country="US")
agentproxy_fetch(url="https://amazon.com/dp/B0BSHF7WHW", country="DE")
agentproxy_fetch(url="https://amazon.com/dp/B0BSHF7WHW", country="JP")

# Multi-step workflow with same IP — login then scrape
agentproxy_session(session_id="workflow01", url="https://example.com/login")
agentproxy_session(session_id="workflow01", url="https://example.com/dashboard")
agentproxy_session(session_id="workflow01", url="https://example.com/data")

# Render a JS-heavy page (requires NOVADA_BROWSER_WS)
agentproxy_render(url="https://zillow.com/homes/NYC_rb/", wait_for=".list-card")

# Web search
agentproxy_search(query="AI proxy tools 2025", num=5)
```

## Network

| Metric | Value |
|--------|-------|
| Residential IPs | 2,000,000+ |
| Live nodes | 7,000+ |
| Countries | 195+ |
| Device types | Android, Windows, Mac |

## Confirmed Working

Amazon, LinkedIn, Cloudflare-protected sites, HackerNews, GitHub, Wikipedia, BBC, CNN, Reddit, IMDB, and more.

## Known Limitations

- Sites requiring full JS execution → use `agentproxy_render`
- `agentproxy_render` requires a separate Browser API subscription and `NOVADA_BROWSER_WS` env var
- Session IDs must not contain hyphens
- For reliable sticky sessions, set `NOVADA_PROXY_HOST` to your account-specific proxy host

## License

MIT — Powered by [Novada](https://www.novada.com)
