# Round 1 ISP Proxy Test Results

**Date:** 2026-04-27
**Provider:** Novada (zone-isp)
**Version:** 1.7.6
**Credentials:** novada711hVp_J5g2CS / zone-isp
**Round:** 1 (search, batch, session, fetch, extract)

## Summary

| # | Test | Status | Latency | Notes |
|---|------|--------|---------|-------|
| T1 | Search "best proxy for AI agents" | FAIL | - | 402: API key has no search permission |
| T2 | Batch fetch (4 URLs) | PASS | 2589ms | 4/4 succeeded, origin=88.216.242.252 |
| T3 | Sticky session (verify) | PASS | 1059ms | session_verified=true, origin=149.52.118.74 |
| T4 | Fetch GitHub (moderate anti-bot) | PASS | 1243ms | 200 OK, 228KB HTML, NovadaLabs org page |
| T5 | Extract BBC News | PASS | 1009ms | title+description extracted, image=null, links=[] |

**Result: 4/5 PASS, 1 FAIL**

## Details

### T1: Search "best proxy for AI agents" -- FAIL
```json
{
  "ok": false,
  "error": {
    "code": "UNKNOWN_ERROR",
    "message": "Novada search error (402): Api Key error：User has no permission",
    "recoverable": true,
    "agent_instruction": "Retry the request. Check agentproxy_status for network health."
  }
}
```
**Analysis:** The API key `1f35b477c9e1802778ec64aee2a6adfa` does not have search (SERP) permission. This is an account/plan limitation, not a code bug. Error code could be more specific (e.g., `PERMISSION_DENIED` instead of `UNKNOWN_ERROR`).

### T2: Batch fetch (4 URLs) -- PASS
```json
{
  "ok": true,
  "tool": "agentproxy_batch_fetch",
  "data": {
    "requested": 4,
    "succeeded": 4,
    "failed": 0,
    "results": [
      {
        "url": "https://httpbin.org/ip",
        "ok": true,
        "status_code": 200,
        "content": "{\n  \"origin\": \"88.216.242.252\"\n}\n",
        "size_bytes": 33,
        "cache_hit": false,
        "latency_ms": 2589
      },
      {
        "url": "https://example.com",
        "ok": true,
        "status_code": 200,
        "content": "Example Domain# Example Domain\n\nThis domain is for use in documentation examples without needing permission. Avoid use in operations.\n\n[Learn more](https://iana.org/domains/example)",
        "size_bytes": 528,
        "cache_hit": false,
        "latency_ms": 1151
      },
      {
        "url": "https://httpbin.org/headers",
        "ok": true,
        "status_code": 200,
        "content": "{\n  \"headers\": {\n    \"Accept\": \"text/html,application/xhtml+xml,*/*;q=0.8\", \n    \"Accept-Encoding\": \"gzip, deflate, br\", \n    \"Accept-Language\": \"en-US,en;q=0.9\", \n    \"Host\": \"httpbin.org\", \n    \"User-Agent\": \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36\", \n    \"X-Amzn-Trace-Id\": \"Root=1-69f10ff0-2b7dbcb24d4011932a5d6346\"\n  }\n}\n",
        "size_bytes": 398,
        "cache_hit": false,
        "latency_ms": 1966
      },
      {
        "url": "https://httpbin.org/user-agent",
        "ok": true,
        "status_code": 200,
        "content": "{\n  \"user-agent\": \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36\"\n}\n",
        "size_bytes": 134,
        "cache_hit": false,
        "latency_ms": 2117
      }
    ]
  },
  "meta": {
    "latency_ms": 2589,
    "concurrency": 3,
    "quota": {
      "credits_estimated": 4,
      "note": "Check dashboard.novada.com for real-time balance"
    }
  }
}
```

### T3: Sticky session (verify) -- PASS
```json
{
  "ok": true,
  "tool": "agentproxy_session",
  "data": {
    "url": "https://httpbin.org/ip",
    "status_code": 200,
    "content": "{\n  \"origin\": \"149.52.118.74\"\n}\n",
    "content_type": "application/json",
    "size_bytes": 32
  },
  "meta": {
    "latency_ms": 1059,
    "session_id": "ispround1",
    "truncated": false,
    "quota": {
      "credits_estimated": 3,
      "note": "Check dashboard.novada.com for real-time balance"
    },
    "cache_hit": false,
    "session_verified": true
  }
}
```

### T4: Fetch GitHub (moderate anti-bot) -- PASS
```json
{
  "ok": true,
  "tool": "agentproxy_fetch",
  "data": {
    "url": "https://github.com/NovadaLabs",
    "status_code": 200,
    "content_type": "text/html; charset=utf-8",
    "size_bytes": 228306
  },
  "meta": {
    "latency_ms": 1243,
    "truncated": false,
    "quota": {
      "credits_estimated": 1,
      "note": "Check dashboard.novada.com for real-time balance"
    },
    "cache_hit": false
  }
}
```
**Note:** Full HTML content returned (228KB). Contains NovadaLabs org page with 5 repos listed (Novada-proxy, novada-mcp, novada-webunblocker-skill, novada-scraper-skill, agent-config). GitHub anti-bot was bypassed successfully via ISP proxy.

### T5: Extract BBC News -- PASS (partial)
```json
{
  "ok": true,
  "tool": "agentproxy_extract",
  "data": {
    "url": "https://www.bbc.com/news",
    "fields": {
      "title": "BBC News - Breaking news, video and the latest top stories from the U.S. and around the world",
      "description": "Visit BBC News for the latest news, breaking news, video, audio and analysis. BBC News provides trusted World, U.S. and U.K. news as well as local and regional perspectives. Also entertainment, climate, business, science, technology and health news.",
      "image": null,
      "links": []
    },
    "extracted_via": "proxy_fetch"
  },
  "meta": {
    "latency_ms": 1009,
    "quota": {
      "credits_estimated": 1,
      "note": "Check dashboard.novada.com for real-time balance"
    }
  }
}
```
**Note:** Title and description extracted correctly from meta tags. However, `image` is null and `links` is empty. BBC News loads content dynamically via JavaScript -- the proxy_fetch extraction only gets static HTML meta tags. A render-based extraction (headless browser) would be needed for full link/image extraction from BBC's SPA-like architecture.

## Issues Found

1. **T1 - Search permission:** Error code should be `PERMISSION_DENIED` or `AUTH_ERROR` instead of `UNKNOWN_ERROR` for a 402 status. The `agent_instruction` says "Retry the request" which is misleading for a permission error -- retrying won't help.

2. **T5 - Extract shallow:** `image` and `links` fields are empty because BBC News renders content via JavaScript. The `extracted_via: "proxy_fetch"` path only parses static HTML. Consider falling back to `agentproxy_render` or documenting this limitation.
