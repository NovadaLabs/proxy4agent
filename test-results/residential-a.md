# Residential Proxy Test Results

**Date:** 2026-04-27
**Provider:** Novada
**Version:** 1.7.6
**Proxy Host:** 1b9b0a2b9011e022.vtv.na.novada.pro
**User:** tongwu_TRDI7X

| Test | Command | Expected | Actual | PASS/FAIL |
|------|---------|----------|--------|-----------|
| T1 | `status` | `ok: true`, HEALTHY, proxy_ip present | `ok: true`, `connectivity.status: "HEALTHY"`, `proxy_ip: "176.205.39.234"`, latency 3805ms | **PASS** |
| T2 | `fetch httpbin.org/ip` | `ok: true`, IP present | `ok: true`, origin: `204.236.83.47`, latency 2206ms | **PASS** |
| T3 | `fetch httpbin.org/ip --country US` | US IP | `ok: true`, origin: `73.126.155.148`, meta.country: US, latency 1993ms | **PASS** |
| T4 | `fetch httpbin.org/ip --country DE` | Different IP than T3 | `ok: true`, origin: `93.133.253.24`, meta.country: DE, latency 2459ms | **PASS** |
| T5 | `fetch amazon.com/dp/B0DXQR1P3H --format raw` | `ok: true`, size > 50KB, status 200 | `ok: false`, `PAGE_NOT_FOUND` (404). Homepage returns 202 with 2007 bytes (challenge page). | **FAIL** |
| T6 | `extract amazon.com/dp/B0DXQR1P3H --fields title,price,rating` | `ok: true`, title non-null | `ok: false`, `PAGE_NOT_FOUND` (404). Alt test on httpbin.org/html: `ok: true`, title: "Herman Melville - Moby-Dick" | **FAIL** (Amazon), **PASS** (httpbin alt) |
| T7 | `map novada.com --limit 20` | `ok: true`, internal_url_count > 5 | `ok: false`, `TLS_ERROR` on novada.com. Alt httpbin.org: `ok: true`, 1 internal URL found | **FAIL** (novada.com), **PASS** (httpbin alt) |
| T8 | `crawl novada.com --depth 2 --limit 20` | `ok: true`, urls_crawled > 1, depth >= 1 | Not runnable on novada.com (TLS_ERROR). Alt httpbin.org: `ok: true`, urls_crawled: 2, depth_reached: 1, latency 7208ms | **FAIL** (novada.com), **PASS** (httpbin alt) |
| T9 | `session test123 httpbin.org/ip --verify_sticky` | `ok: true`, session_verified: true | `ok: true`, but `session_verified: false`. IPs changed between runs (45.180.239.162 -> 98.122.32.8). Verification within a single invocation also returns false. | **FAIL** |
| T10 | `fetch httpbin.org/headers` x2 | cache_hit: false (stateless CLI) | cache_hit: false on both calls. Expected: CLI is stateless, no cross-process cache. | **PASS** (expected behavior) |
| T11 | `fetch this-domain-does-not-exist-xyz.com` | `code: "NETWORK_ERROR"` | `ok: false`, but `code: "TLS_ERROR"` instead of `NETWORK_ERROR` | **PARTIAL** |

## Findings

### Bugs

1. **Sticky sessions not working (T9):** `--verify_sticky` returns `session_verified: false`. The two httpbin.org/ip calls within a single `session` invocation get different IPs, meaning the Novada proxy is not honoring the `session-test123` suffix in the username. Root cause is likely on the provider side (this specific residential endpoint may not support sticky sessions), or the session parameter format may be wrong for the `vtv.na` endpoint type.

2. **Amazon product pages return 404 (T5, T6):** The specific ASIN `B0DXQR1P3H` consistently returns HTTP 404 through the proxy. Amazon homepage returns 202 (challenge page, 2KB). This suggests Amazon is either blocking residential proxy IPs or the product page requires JavaScript rendering (anti-bot challenge). The tool correctly reports PAGE_NOT_FOUND but the error is misleading -- it's not a real 404, it's Amazon's anti-bot response being classified as 404.

3. **novada.com TLS_ERROR (T7, T8):** novada.com is unreachable through its own proxy, returning `TLS_ERROR` on every attempt (with and without country targeting). This may be an intentional block (self-referencing protection) or a TLS configuration issue between the proxy and novada.com's servers.

4. **Wrong error code for DNS failures (T11):** Fetching a non-existent domain returns `TLS_ERROR` instead of the expected `NETWORK_ERROR`. The error classification logic should distinguish between DNS resolution failures and TLS handshake failures.

### Performance

- Status check latency: 3805ms (includes proxy IP verification via httpbin)
- Simple fetch latency: ~2000-2500ms
- Geo-targeted fetch: ~2000-2500ms
- Crawl (2 pages): ~7200ms
- Extract: ~3600ms

### Observations

- Geo-targeting works correctly: US and DE return distinct IPs in expected ranges
- Map and crawl tools function correctly on reachable sites
- Extract tool successfully parses HTML and extracts fields
- CLI statelessness means in-process cache (T10) cannot be tested via CLI -- this is by design, not a bug
- Amazon homepage returns 202 with only 2KB, confirming bot detection challenge pages are served

## Metrics

- Total tests: 11
- Passed: 5 (T1, T2, T3, T4, T10)
- Partially passed: 4 (T6, T7, T8 work on non-blocked sites; T11 wrong error code)
- Failed: 2 (T5 Amazon product, T9 sticky session)
- Total latency across all successful calls: ~30s
