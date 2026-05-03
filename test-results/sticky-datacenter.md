# Sticky Session Test — Datacenter Proxy (dcp)

**Date:** 2026-04-27
**Zone:** dcp (rotating datacenter)
**Command:**
```bash
NOVADA_PROXY_USER="***" NOVADA_PROXY_PASS="***" NOVADA_PROXY_ZONE="dcp" \
  node build/cli.js session dcpsticky1 https://httpbin.org/ip --verify_sticky
```

## Result

| Field              | Value                |
|--------------------|----------------------|
| ok                 | true                 |
| session_verified   | true                 |
| session_id         | dcpsticky1           |
| origin IP          | 131.222.210.167      |
| latency_ms         | 3396                 |
| credits_estimated  | 3                    |

## Proxy URL Format

Username constructed by adapter:
```
novada836jyS_qHUt82-zone-dcp-session-dcpsticky1-sessTime-5
```

- `-sessTime-5` appended for dcp zone (5 min default; max 30 min for dcp)
- Verification: two consecutive httpbin.org/ip calls returned the same IP

## Raw Response

```json
{
  "ok": true,
  "tool": "novada_proxy_session",
  "data": {
    "url": "https://httpbin.org/ip",
    "status_code": 200,
    "content": "{\n  \"origin\": \"131.222.210.167\"\n}\n",
    "content_type": "application/json",
    "size_bytes": 34
  },
  "meta": {
    "latency_ms": 3396,
    "session_id": "dcpsticky1",
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
