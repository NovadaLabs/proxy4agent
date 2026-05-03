# Design Spec: Schema-Based LLM Extraction Mode

## Overview
Add a `schema` parameter to `novada_proxy_extract` that enables LLM-ready structured extraction. When `schema` is passed, the tool returns cleaned content + an extraction prompt that the calling agent can process directly.

**Key insight:** The calling agent (Claude, GPT, Gemini) IS an LLM. Instead of calling an external LLM API (cost + API key), we prepare the content for the agent to extract from. Zero additional cost.

## API Change (backward compatible)

### New parameter: `schema`
```typescript
// Added to ExtractParams
schema?: Record<string, string>;  // { field_name: description }
```

Example:
```json
{
  "url": "https://example.com/product",
  "schema": {
    "product_name": "The full product name",
    "price": "Current price in USD",
    "shipping_date": "Expected shipping date",
    "return_policy": "Return policy summary",
    "warranty": "Warranty terms"
  }
}
```

### Behavior when `schema` is passed
1. Fetch the page (same as now — proxy fetch, with render_fallback if set)
2. Clean HTML with `stripNoiseElements` + convert to markdown
3. Return response with `data.mode: "llm_extract"` containing:
   - `data.content` — cleaned markdown (the raw material for extraction)
   - `data.extraction_prompt` — a structured prompt the agent should follow
   - `data.schema` — echo back the schema for reference
   - `data.url` — the source URL

### Behavior when `schema` is NOT passed
Unchanged — existing heuristic extraction (fields param, meta tags, JSON-LD).

### The extraction_prompt
```
Extract the following fields from the content below. Return ONLY a JSON object with the field names as keys.

Fields to extract:
- product_name: The full product name
- price: Current price in USD  
- shipping_date: Expected shipping date
- return_policy: Return policy summary
- warranty: Warranty terms

If a field cannot be found, set its value to null.

CONTENT:
[cleaned markdown content here, truncated to 50K chars]
```

### Response format (schema mode)
```json
{
  "ok": true,
  "tool": "novada_proxy_extract",
  "data": {
    "mode": "llm_extract",
    "url": "https://example.com/product",
    "schema": { "product_name": "...", "price": "...", ... },
    "content": "[cleaned markdown, max 50K chars]",
    "extraction_prompt": "[the structured prompt above]",
    "content_length": 12345
  },
  "meta": {
    "latency_ms": 234,
    "content_density": 0.72,
    "quota": { "credits_estimated": 1 }
  }
}
```

### Response format (heuristic mode — unchanged)
```json
{
  "ok": true,
  "tool": "novada_proxy_extract",
  "data": {
    "mode": "heuristic",
    "url": "...",
    "fields": { "title": "...", "price": "..." },
    "extracted_via": "proxy_fetch"
  },
  "meta": { ... }
}
```

## Validation rules
- `schema` must be an object with string keys and string values
- `schema` must have 1-20 fields
- When `schema` is passed, `fields` param is ignored (they're mutually exclusive)
- Field descriptions must be non-empty strings

## Tool description update
Add to the existing description:
```
SCHEMA MODE (LLM extraction): Pass schema:{field_name: "description"} instead of fields for arbitrary extraction. 
Returns cleaned content + extraction prompt — your agent does the extraction (zero additional cost, works with any LLM). 
Example: schema:{"price":"Current price in USD","warranty":"Warranty terms"}
```

## Files to modify
1. `src/tools/extract.ts` — add schema handling to ExtractParams, handler, validator
2. `src/index.ts` — add schema to input schema, update description
3. `src/cli.ts` — add --schema flag
4. `src/__tests__/extract.test.ts` — add schema mode tests
5. `README.md` — add schema mode documentation

## What NOT to change
- Existing heuristic mode (fields param) — fully backward compatible
- Tool name stays `novada_proxy_extract`
- Error handling unchanged
- render_fallback works with both modes
