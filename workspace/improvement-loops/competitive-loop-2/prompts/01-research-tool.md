# Competitive Loop 2 — Research Tool Implementation

## Task
Implement `novada_proxy_research` — a one-shot deep research tool that chains search → batch_fetch → synthesis. This closes Critical Gap #2 from the competitive analysis (Firecrawl has firecrawl_agent, Tavily has tavily_research — we have nothing).

## Design

### Tool interface
```
novada_proxy_research({
  query: string,          // Research question
  depth: "quick" | "standard" | "deep",  // quick=3 sources, standard=5, deep=10
  country?: string,       // Geo-target the search
  format?: "summary" | "detailed" | "raw",  // Output format
  timeout?: number        // Overall timeout
})
```

### Response
```json
{
  "ok": true,
  "tool": "novada_proxy_research",
  "data": {
    "query": "...",
    "sources_searched": 5,
    "sources_fetched": 4,
    "sources_failed": 1,
    "key_findings": [
      { "finding": "...", "source": "url", "confidence": "high|medium|low" }
    ],
    "sources": [
      { "url": "...", "title": "...", "snippet": "...", "content_preview": "..." }
    ],
    "synthesis": "Multi-paragraph synthesis of all findings..."
  },
  "meta": { "latency_ms": ..., "quota": { "credits_estimated": ... } }
}
```

### Implementation
1. Call novada_proxy_search (or novadaProxySearch internally)
2. Take top N results based on depth
3. Call novadaProxyBatchFetch on those URLs
4. Extract key findings from each page (title, first paragraphs, relevant sections)
5. Build synthesis from findings
6. Return structured response

The synthesis should be done by the tool itself (heuristic-based), not by an LLM call. This keeps it free and fast. The agent can do deeper analysis on the raw content.

## Files to create/modify
- New: `src/tools/research.ts` — handler + validator
- Modify: `src/tools/index.ts` — export new tool
- Modify: `src/index.ts` — register tool, add to TOOLS array + dispatch
- Modify: `src/cli.ts` — add CLI support
- New: `src/__tests__/research.test.ts` — tests

## Rules
- Follow existing patterns (look at how crawl.ts is structured)
- Use InputValidationError for validation
- Include agent_instruction in error responses
- Add CHAIN WITH and WHEN TO USE guidance in description
- All tests must pass
