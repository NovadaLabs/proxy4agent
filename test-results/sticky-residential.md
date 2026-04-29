# Residential Sticky Session Test Results

**Date:** 2026-04-27
**Provider:** Novada (zone-res)
**Version:** 1.7.6
**Endpoint:** `1b9b0a2b9011e022.vtv.na.novada.pro:7777`
**Adapter:** `src/adapters/novada.ts` -- appends `-sessTime-5` for res zone

## Summary

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1 | `session ressticky1 --verify_sticky` | FAIL | ok:true but session_verified:false -- IPs differ across calls |
| 2 | `session ressticky2` (no verify) | PASS | ok:true, status 200, IP returned, session_id in meta |
| 3 | `session ressticky3 --verify_sticky` (retry) | FAIL | ok:true but session_verified:false -- confirmed not transient |
| 4 | curl raw verification | FAIL | Same session string, 2 calls, 2 different IPs |
| 5 | curl with sessTime-30 | FAIL | Longer session time, still different IPs |
| 6 | Node.js 3-call debug | FAIL | IP1=IP2, IP3 differs (partial stickiness) |
| 7 | Adapter `-sessTime-5` suffix | PASS | Username format correct per Novada docs |

**Result: FAIL** -- Proxy routing works (ok:true) but sticky sessions do NOT hold on this residential endpoint. The endpoint `1b9b0a2b9011e022.vtv.na.novada.pro` does not honor `-session-ID-sessTime-N` for the `res` zone. This is a provider-side issue, not a code bug.

**Contrast:** ISP zone (`sticky-isp.md`) achieved `session_verified:true` on `super.novada.pro` with the same adapter logic.

## Test 1: --verify_sticky

**Command:**
```bash
NOVADA_PROXY_USER="tongwu_TRDI7X" NOVADA_PROXY_PASS="***" NOVADA_PROXY_HOST="1b9b0a2b9011e022.vtv.na.novada.pro" \
  node build/cli.js session ressticky1 https://httpbin.org/ip --verify_sticky
```

```json
{
  "ok": true,
  "tool": "agentproxy_session",
  "data": {
    "url": "https://httpbin.org/ip",
    "status_code": 200,
    "content": "{\n  \"origin\": \"170.238.198.225\"\n}\n",
    "content_type": "application/json",
    "size_bytes": 34
  },
  "meta": {
    "latency_ms": 2931,
    "session_id": "ressticky1",
    "truncated": false,
    "quota": {
      "credits_estimated": 3,
      "note": "Check dashboard.novada.com for real-time balance"
    },
    "cache_hit": false,
    "session_verified": false
  }
}
```

## Test 2: Basic session (no verify)

**Command:**
```bash
NOVADA_PROXY_USER="tongwu_TRDI7X" NOVADA_PROXY_PASS="***" NOVADA_PROXY_HOST="1b9b0a2b9011e022.vtv.na.novada.pro" \
  node build/cli.js session ressticky2 https://httpbin.org/ip
```

```json
{
  "ok": true,
  "tool": "agentproxy_session",
  "data": {
    "url": "https://httpbin.org/ip",
    "status_code": 200,
    "content": "{\n  \"origin\": \"77.101.254.38\"\n}\n",
    "content_type": "application/json",
    "size_bytes": 32
  },
  "meta": {
    "latency_ms": 2854,
    "session_id": "ressticky2",
    "truncated": false,
    "quota": {
      "credits_estimated": 1,
      "note": "Check dashboard.novada.com for real-time balance"
    },
    "cache_hit": false
  }
}
```

## Test 3: --verify_sticky retry (fresh session)

**Command:** Same as Test 1, session_id `ressticky3`.

```json
{
  "ok": true,
  "tool": "agentproxy_session",
  "data": {
    "url": "https://httpbin.org/ip",
    "status_code": 200,
    "content": "{\n  \"origin\": \"186.237.105.147\"\n}\n",
    "content_type": "application/json",
    "size_bytes": 34
  },
  "meta": {
    "latency_ms": 2592,
    "session_id": "ressticky3",
    "truncated": false,
    "quota": {
      "credits_estimated": 3,
      "note": "Check dashboard.novada.com for real-time balance"
    },
    "cache_hit": false,
    "session_verified": false
  }
}
```

## Test 4-5: curl raw verification

```bash
# sessTime-5
curl --proxy "http://tongwu_TRDI7X-zone-res-session-curlsticky1-sessTime-5:***@1b9b0a2b9011e022.vtv.na.novada.pro:7777" https://httpbin.org/ip
# Call 1: 37.212.58.218
# Call 2: 119.160.215.109  (DIFFERENT)

# sessTime-30
curl --proxy "http://tongwu_TRDI7X-zone-res-session-curlsticky2-sessTime-30:***@1b9b0a2b9011e022.vtv.na.novada.pro:7777" https://httpbin.org/ip
# Call 1: 131.222.210.149
# Call 2: 45.70.53.158  (DIFFERENT)
```

## Test 6: Node.js 3-call debug

```
IP 1: 185.254.180.155
IP 2: 185.254.180.155  (same -- brief stickiness)
IP 3: 196.207.227.134  (rotated)
```

Partial stickiness (IP held for ~2 seconds), then rotated. This is consistent with the endpoint not properly binding residential sessions.

## Adapter URL Format Verification

The Novada adapter produces the correct username format:

```
tongwu_TRDI7X-zone-res-session-ressticky1-sessTime-5
```

This matches Novada's documented auth format: `USERNAME-zone-ZONE-session-ID-sessTime-N`. The `-sessTime-5` suffix is correctly appended (line 62 of `src/adapters/novada.ts`).

## Root Cause

The endpoint `1b9b0a2b9011e022.vtv.na.novada.pro` does not reliably bind residential sessions. Possible causes:
1. This VTV-NA endpoint may not support sticky sessions for the `res` zone
2. The account/plan may not have sticky session entitlement on this endpoint
3. The endpoint's session binding latency exceeds the inter-request gap

**Recommendation:** Test with `super.novada.pro` (shared load balancer) or contact Novada support about sticky session support on this specific endpoint.
