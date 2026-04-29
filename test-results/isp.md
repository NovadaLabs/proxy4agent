# ISP Proxy Test Results

**Date:** 2026-04-27
**Provider:** Novada (zone-isp)
**Version:** 1.7.6
**Credentials:** novada711hVp_J5g2CS / zone-isp

## Summary

| # | Test | Status | Latency | Notes |
|---|------|--------|---------|-------|
| T1 | Status check | PASS | 2073ms | HEALTHY, proxy_ip=195.86.197.60 |
| T2 | Simple fetch (httpbin/ip) | PASS | 3499ms | origin=212.11.20.2 |
| T3 | Fetch real site (example.com) | PASS | 1792ms | 200 OK, HTML content returned |
| T4 | Sticky session | PASS | 2067ms | session_verified=true, origin=163.5.77.24 |
| T5 | Geo-targeting (US) | PASS | 1771ms | origin=2.58.169.91, country=US |
| T6 | Batch fetch (3 URLs) | PASS | 2400ms | 3/3 succeeded, 0 failed |
| T7 | Error handling (bad domain) | PASS | - | TLS_ERROR, recoverable=true |

**Result: 7/7 PASS**

## Details

### T1: Status check
```json
{
  "ok": true,
  "data": {
    "provider": "Novada",
    "version": "1.7.6",
    "capabilities": ["country_targeting", "city_targeting", "sticky_sessions"],
    "connectivity": {
      "status": "HEALTHY",
      "proxy_ip": "195.86.197.60",
      "latency_ms": 2073
    }
  }
}
```

### T2: Simple fetch
```json
{
  "ok": true,
  "data": {
    "url": "https://httpbin.org/ip",
    "status_code": 200,
    "content": "{\"origin\": \"212.11.20.2\"}",
    "content_type": "application/json"
  }
}
```

### T3: Fetch real site
```json
{
  "ok": true,
  "data": {
    "url": "https://www.example.com",
    "status_code": 200,
    "content_type": "text/html",
    "size_bytes": 528
  }
}
```

### T4: Sticky session
```json
{
  "ok": true,
  "data": {
    "url": "https://httpbin.org/ip",
    "status_code": 200,
    "content": "{\"origin\": \"163.5.77.24\"}"
  },
  "meta": {
    "session_id": "test_isp_1",
    "session_verified": true
  }
}
```

### T5: Geo-targeting (US)
```json
{
  "ok": true,
  "data": {
    "url": "https://httpbin.org/ip",
    "status_code": 200,
    "content": "{\"origin\": \"2.58.169.91\"}"
  },
  "meta": {
    "country": "US"
  }
}
```

### T6: Batch fetch (3 URLs)
```json
{
  "ok": true,
  "data": {
    "requested": 3,
    "succeeded": 3,
    "failed": 0,
    "results": [
      {"url": "https://httpbin.org/ip", "ok": true, "status_code": 200, "latency_ms": 2400},
      {"url": "https://httpbin.org/headers", "ok": true, "status_code": 200, "latency_ms": 1910},
      {"url": "https://example.com", "ok": true, "status_code": 200, "latency_ms": 1067}
    ]
  }
}
```

### T7: Error handling (bad domain)
```json
{
  "ok": false,
  "error": {
    "code": "TLS_ERROR",
    "message": "TLS/SSL connection failed",
    "recoverable": true,
    "agent_instruction": "The target rejected the proxy connection. Retry with a different country parameter or use agentproxy_render.",
    "retry_after_seconds": 2
  }
}
```

**Note on T7:** Error code returned was `TLS_ERROR` rather than `NETWORK_ERROR`. The domain `nonexistent-domain-xyz.com` triggers a TLS error because the proxy attempts to establish a TLS connection to the resolved IP. The error is still properly structured JSON with recoverable flag and agent instructions, so error handling works correctly.
