# Round 1 — Residential Proxy Tests

Date: 2026-04-27
Proxy: `1b9b0a2b9011e022.vtv.na.novada.pro` (residential)
User: `tongwu_TRDI7X`

---

## T1: Wikipedia fetch

- **ok:** true
- **status_code:** 200
- **size_bytes:** 165507
- **latency_ms:** 4602
- **content_type:** text/html; charset=UTF-8
- **truncated:** false
- **cache_hit:** false
- **content preview (first 200 chars):** `Web scraping - Wikipedia\n\n- \n\n- \n\n- \n- \n- \n- \n- \n- \n- \n- \n- \n- \n- \n\n[Jump to content](#bodyContent)\n\n\t\n\t\t\n\t\t\t\n\t\t\t\t\n\n\t\n\t\n\nMain menu`
- **error:** none
- **RESULT: PASS**

Raw JSON:
```json
{
  "ok": true,
  "tool": "novada_proxy_fetch",
  "data": {
    "url": "https://en.wikipedia.org/wiki/Web_scraping",
    "status_code": 200,
    "content": "[165507 bytes of Wikipedia markdown content]",
    "content_type": "text/html; charset=UTF-8",
    "size_bytes": 165507
  },
  "meta": {
    "latency_ms": 4602,
    "truncated": false,
    "quota": {
      "credits_estimated": 1,
      "note": "Check dashboard.novada.com for real-time balance"
    },
    "cache_hit": false
  }
}
```

---

## T2: Shopify extract (Allbirds)

- **ok:** true
- **latency_ms:** 6841
- **extracted_via:** proxy_fetch
- **extracted fields:**
  - **title:** Men's Tree Runner - Jet Black (White Sole)
  - **price:** $2
  - **description:** The Allbirds Tree Runner is a breathable and lightweight sneaker made with responsibly sourced eucalyptus tree fiber that feels silky smooth and cool on your skin. These shoes are perfect for everyday casual wear, walking, and warmer weather.
  - **image:** `http://www.allbirds.com/cdn/shop/files/TR3MJBW080_SHOE_LEFT_GLOBAL_MENS_TREE_RUNNER_JET_BLACK_WHITE.png?v=1751165486`
- **error:** none
- **NOTE:** Price "$2" looks incorrect — likely a parsing issue (real price is ~$98). The title, description, and image extracted correctly.
- **RESULT: PASS (with price caveat)**

Raw JSON:
```json
{
  "ok": true,
  "tool": "novada_proxy_extract",
  "data": {
    "url": "https://www.allbirds.com/products/mens-tree-runners",
    "fields": {
      "title": "Men's Tree Runner - Jet Black (White Sole)",
      "price": "$2",
      "description": "The Allbirds Tree Runner is a breathable and lightweight sneaker made with responsibly sourced eucalyptus tree fiber that feels silky smooth and cool on your skin. These shoes are perfect for everyday casual wear, walking, and warmer weather.",
      "image": "http://www.allbirds.com/cdn/shop/files/TR3MJBW080_SHOE_LEFT_GLOBAL_MENS_TREE_RUNNER_JET_BLACK_WHITE.png?v=1751165486"
    },
    "extracted_via": "proxy_fetch"
  },
  "meta": {
    "latency_ms": 6841,
    "quota": {
      "credits_estimated": 1,
      "note": "Check dashboard.novada.com for real-time balance"
    }
  }
}
```

---

## T3: Crawl example.com

- **ok:** true
- **latency_ms:** 2250
- **urls_crawled:** 1
- **depth_reached:** 0
- **urls_discovered:** 0
- **pages:**
  | URL | Depth | Status | Links Found |
  |-----|-------|--------|-------------|
  | https://example.com | 0 | 200 | 0 |
- **sitemap_hint:** https://example.com/sitemap.xml (not crawled)
- **error:** none
- **NOTE:** example.com has no internal links, so depth=2 crawl only finds the root page. This is correct behavior — not a bug.
- **RESULT: PASS**

Raw JSON:
```json
{
  "ok": true,
  "tool": "novada_proxy_crawl",
  "data": {
    "start_url": "https://example.com",
    "domain": "example.com",
    "depth_reached": 0,
    "urls_crawled": 1,
    "urls_discovered": 0,
    "pages": [
      {
        "url": "https://example.com",
        "depth": 0,
        "status_code": 200,
        "links_found": 0
      }
    ],
    "sitemap_hint": "https://example.com/sitemap.xml (not crawled — check manually for a complete URL list)"
  },
  "meta": {
    "latency_ms": 2250,
    "quota": {
      "credits_estimated": 1,
      "note": "Check dashboard.novada.com for real-time balance"
    }
  }
}
```

---

## T4: Geo JP (httpbin/ip)

- **ok:** true
- **status_code:** 200
- **latency_ms:** 9001
- **proxy IP:** 37.19.205.250
- **country confirmed:** YES — Japan (Tokyo), verified via ip-api.com
  - ISP: Datacamp Limited
  - Org: Cdnext TYO
  - AS: AS212238 Datacamp Limited
- **meta.country:** JP
- **cache_hit:** false
- **error:** none
- **RESULT: PASS**

Raw JSON:
```json
{
  "ok": true,
  "tool": "novada_proxy_fetch",
  "data": {
    "url": "https://httpbin.org/ip",
    "status_code": 200,
    "content": "{\n  \"origin\": \"37.19.205.250\"\n}\n",
    "content_type": "application/json",
    "size_bytes": 32
  },
  "meta": {
    "latency_ms": 9001,
    "country": "JP",
    "truncated": false,
    "quota": {
      "credits_estimated": 1,
      "note": "Check dashboard.novada.com for real-time balance"
    },
    "cache_hit": false
  }
}
```

GeoIP verification:
```json
{"status":"success","country":"Japan","countryCode":"JP","region":"13","regionName":"Tokyo","city":"Tokyo","zip":"102-0082","lat":35.6893,"lon":139.6899,"timezone":"Asia/Tokyo","isp":"Datacamp Limited","org":"Cdnext TYO","as":"AS212238 Datacamp Limited","query":"37.19.205.250"}
```

---

## T5: Map HackerNews

- **ok:** true
- **latency_ms:** 2244
- **internal_url_count:** 30
- **external_url_count:** 0
- **total_found:** 161 (truncated to 30 by --limit)
- **truncated:** true
- **sample URLs (first 5):**
  1. `https://news.ycombinator.com`
  2. `https://news.ycombinator.com/news`
  3. `https://news.ycombinator.com/newest`
  4. `https://news.ycombinator.com/front`
  5. `https://news.ycombinator.com/newcomments`
- **sitemap_hint:** https://news.ycombinator.com/sitemap.xml (check manually)
- **error:** none
- **RESULT: PASS**

Raw JSON:
```json
{
  "ok": true,
  "tool": "novada_proxy_map",
  "data": {
    "source_url": "https://news.ycombinator.com",
    "domain": "news.ycombinator.com",
    "internal_url_count": 30,
    "external_url_count": 0,
    "total_found": 161,
    "truncated": true,
    "internal_urls": [
      "https://news.ycombinator.com",
      "https://news.ycombinator.com/news",
      "https://news.ycombinator.com/newest",
      "https://news.ycombinator.com/front",
      "https://news.ycombinator.com/newcomments",
      "https://news.ycombinator.com/ask",
      "https://news.ycombinator.com/show",
      "https://news.ycombinator.com/jobs",
      "https://news.ycombinator.com/submit",
      "https://news.ycombinator.com/login?goto=news",
      "https://news.ycombinator.com/vote?id=47939579&amp;how=up&amp;goto=news",
      "https://news.ycombinator.com/from?site=mitchellh.com",
      "https://news.ycombinator.com/user?id=WadeGrimridge",
      "https://news.ycombinator.com/item?id=47939579",
      "https://news.ycombinator.com/hide?id=47939579&amp;goto=news",
      "https://news.ycombinator.com/vote?id=47933208&amp;how=up&amp;goto=news",
      "https://news.ycombinator.com/from?site=github.com/localsend",
      "https://news.ycombinator.com/user?id=bilsbie",
      "https://news.ycombinator.com/item?id=47933208",
      "https://news.ycombinator.com/hide?id=47933208&amp;goto=news",
      "https://news.ycombinator.com/vote?id=47939079&amp;how=up&amp;goto=news",
      "https://news.ycombinator.com/from?site=chrisnager.com",
      "https://news.ycombinator.com/user?id=chrisnager",
      "https://news.ycombinator.com/item?id=47939079",
      "https://news.ycombinator.com/hide?id=47939079&amp;goto=news",
      "https://news.ycombinator.com/vote?id=47939320&amp;how=up&amp;goto=news",
      "https://news.ycombinator.com/from?site=stratechery.com",
      "https://news.ycombinator.com/user?id=translocator",
      "https://news.ycombinator.com/item?id=47939320",
      "https://news.ycombinator.com/hide?id=47939320&amp;goto=news"
    ],
    "sitemap_hint": "https://news.ycombinator.com/sitemap.xml (check manually — not on this page)"
  },
  "meta": {
    "latency_ms": 2244,
    "quota": {
      "credits_estimated": 1,
      "note": "Check dashboard.novada.com for real-time balance"
    }
  }
}
```

---

## Summary: 5/5 PASS

| Test | Tool | ok | Latency (ms) | Key Data | Result |
|------|------|----|-------------|----------|--------|
| T1 | fetch | true | 4,602 | 165KB Wikipedia page | PASS |
| T2 | extract | true | 6,841 | 4 fields extracted (price suspect) | PASS* |
| T3 | crawl | true | 2,250 | 1 page (example.com has no links) | PASS |
| T4 | fetch+geo | true | 9,001 | JP IP confirmed (37.19.205.250) | PASS |
| T5 | map | true | 2,244 | 30/161 URLs returned | PASS |

**Issues to track:**
- T2: Price extracted as "$2" — likely a parsing bug in the extract tool or Allbirds serving different content via proxy. Real price is ~$98.
- T4: 9s latency for JP geo — higher than other tests, possibly JP proxy pool latency.
- T3: example.com has 0 internal links, so crawl depth is inherently 0. Consider using a richer test site for future crawl tests (e.g., docs.example.com or a small blog).
