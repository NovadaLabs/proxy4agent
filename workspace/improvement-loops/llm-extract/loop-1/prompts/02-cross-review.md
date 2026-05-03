# Cross-Review Prompt — LLM Extract Schema Mode

## Task
Review another agent's implementation of schema-based LLM extraction for novada_proxy_extract. You have NOT seen this code before. Find real problems.

## What was supposed to be implemented
1. New `schema` param on novada_proxy_extract — Record<string, string> of field names + descriptions
2. When schema passed: fetch page → clean with htmlToMarkdown → return content + extraction_prompt
3. When schema NOT passed: existing heuristic extraction unchanged (backward compat)
4. Validator accepts schema (1-20 fields, string values), makes fields optional when schema present
5. Tool description updated with SCHEMA MODE guidance
6. CLI --schema flag
7. Tests for schema mode

## Review checklist
- [ ] Does schema mode return mode:"llm_extract" with content, extraction_prompt, schema, url?
- [ ] Does the extraction_prompt include ALL schema field names and descriptions?
- [ ] Is content cleaned (htmlToMarkdown called, stripNoiseElements applied)?
- [ ] Is content truncated to 50K chars?
- [ ] Does heuristic mode still work unchanged? Does it return mode:"heuristic"?
- [ ] Is validation correct? (schema 1-20 fields, string values, fields optional with schema)
- [ ] Is the TOOLS array inputSchema updated? Is required changed from ["url","fields"] to ["url"]?
- [ ] Does --schema CLI flag work?
- [ ] Are tests comprehensive? (schema mode, truncation, validation, backward compat)
- [ ] render_fallback: does it work with schema mode?
- [ ] Any security issues? (HTML in content, injection via schema field names?)
- [ ] Import paths use .js extension?
- [ ] Are there any regressions in existing tests?

## Output format
```
# Cross-Review: [Claude's / Codex's] Implementation

## Verdict: APPROVED / NEEDS_FIX

## Issues Found
- [CRITICAL/HIGH/MEDIUM/LOW] file:line — description

## What's Good
- ...

## Comparison Notes (if you see anything the other approach might do better)
- ...
```
