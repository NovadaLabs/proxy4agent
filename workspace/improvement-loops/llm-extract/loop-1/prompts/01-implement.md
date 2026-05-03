# LLM Extract Implementation Prompt

## Task
Add schema-based LLM extraction mode to `novada_proxy_extract` in the novada-proxy-mcp project at `/Users/tongwu/Projects/agentproxy/`.

## Design (read this fully before coding)

When the user passes a `schema` parameter (object with field_name: description pairs), the tool should:
1. Fetch the page (proxy fetch, with render_fallback if set)
2. Clean HTML with stripNoiseElements + convert to markdown via htmlToMarkdown
3. Return cleaned content + extraction prompt (NOT do the extraction itself)

The calling agent (Claude/GPT) IS the LLM — it extracts from the content using the prompt we provide. Zero additional API cost.

## Implementation details

### 1. Update ExtractParams in src/tools/extract.ts
Add to the interface:
```typescript
schema?: Record<string, string>;  // { field_name: "description of what to extract" }
```

### 2. Update novadaProxyExtract handler in src/tools/extract.ts
After fetching the HTML (the try/catch block that gets `html`), add a branch:

```typescript
if (params.schema) {
  // Schema mode: return cleaned content + extraction prompt
  const markdown = htmlToMarkdown(html);
  const truncated = markdown.length > 50000 ? markdown.slice(0, 50000) : markdown;
  
  const schemaEntries = Object.entries(params.schema)
    .map(([key, desc]) => `- ${key}: ${desc}`)
    .join("\n");
  
  const extractionPrompt = `Extract the following fields from the content below. Return ONLY a JSON object with the field names as keys. If a field cannot be found, set its value to null.\n\nFields to extract:\n${schemaEntries}\n\nCONTENT:\n${truncated}`;
  
  const result: ProxySuccessResponse = {
    ok: true,
    tool: "novada_proxy_extract",
    data: {
      mode: "llm_extract",
      url,
      schema: params.schema,
      content: truncated,
      extraction_prompt: extractionPrompt,
      content_length: truncated.length,
    },
    meta: {
      latency_ms: Date.now() - startTime,
      content_density: contentDensity(truncated.length, countHtmlTags(html)),
      country,
      session_id,
      quota: { credits_estimated: usedRender ? 5 : 1 },
    },
  };
  if (!result.meta.country) delete result.meta.country;
  if (!result.meta.session_id) delete result.meta.session_id;
  return JSON.stringify(result);
}
```

Import `htmlToMarkdown`, `countHtmlTags`, `contentDensity` from `../utils.js`.

The existing heuristic extraction (fields loop) stays as the else branch. Add `mode: "heuristic"` to the existing response data.

### 3. Update validateExtractParams in src/tools/extract.ts
- Accept `schema` as optional parameter
- If `schema` is passed: validate it's an object, 1-20 keys, all values are non-empty strings
- If `schema` is passed, `fields` becomes optional (not required)
- If neither `schema` nor `fields` is passed, throw error

### 4. Update src/index.ts — TOOLS array
Add `schema` to the novada_proxy_extract inputSchema:
```typescript
schema: { 
  type: "object", 
  description: "JSON schema for LLM extraction: {field_name: 'description'}. When provided, returns cleaned content + extraction prompt instead of heuristic extraction. Your agent does the extraction (zero cost). Example: {\"price\": \"Current price in USD\", \"warranty\": \"Warranty terms\"}" 
},
```

Update the description to mention schema mode:
Add: "SCHEMA MODE: Pass schema instead of fields for arbitrary extraction. Returns content + prompt — your agent extracts (zero additional cost, works with any LLM)."

### 5. Update src/cli.ts
Add `--schema` flag that accepts a JSON string:
```
novada-proxy extract <url> --schema '{"price":"Current price","warranty":"Warranty terms"}'
```

### 6. Add tests in src/__tests__/extract.test.ts
Add new describe block for schema mode:
- Test: schema mode returns mode:"llm_extract" with content and extraction_prompt
- Test: extraction_prompt contains all schema field names and descriptions
- Test: content is cleaned markdown (no <nav>, <script> etc.)
- Test: content truncated to 50K chars
- Test: validator accepts schema without fields
- Test: validator rejects schema with 0 fields
- Test: validator rejects schema with >20 fields
- Test: validator rejects schema with non-string values
- Test: heuristic mode still works (mode:"heuristic" in response)
- Test: schema + render_fallback works together

## Verification
```bash
npm run build && npm test
```
All 411+ tests must pass.

## Rules
- Backward compatible — existing fields mode unchanged
- Import paths use .js extension (ESM)
- Use InputValidationError if it exists, otherwise plain Error (check src/errors.ts)
- Read files before editing
- Follow existing code patterns
