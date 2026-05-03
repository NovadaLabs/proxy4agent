# Cross-Review: Claude Code's Implementation
## Verdict: NEEDS_FIX

## Issues Found
- [MEDIUM] src/tools/extract.ts:91 — Schema mode reports `tool: "novada_proxy_extract"`, but the registered MCP tool name is `agentproxy_extract` in src/index.ts:127 and the dispatcher only handles `agentproxy_extract` at src/index.ts:284. Heuristic mode reports `agentproxy_extract` at src/tools/extract.ts:124, so schema mode is inconsistent.
- [MEDIUM] src/tools/extract.ts:80 — Schema mode calls `htmlToMarkdown(html)`, but there is no `stripNoiseElements` implementation or call. `htmlToMarkdown` only removes `script`, `style`, and `noscript` at src/utils.ts:21, so boilerplate such as `nav`, `header`, and `footer` is not removed as required by the spec.
- [LOW] src/tools/extract.ts:444 — Schema validation does not constrain field names before interpolating them into the prompt at src/tools/extract.ts:83. Newlines or instruction text in a field name can alter prompt structure.
- [LOW] src/tools/extract.ts:445 — Whitespace-only descriptions pass because validation checks `v.length === 0`, not `v.trim().length`.

## Checklist Verification
- PASS — Schema mode returns `mode`, `content`, `extraction_prompt`, `schema`, and `url`: src/tools/extract.ts:89.
- PASS — Prompt includes all schema entries via `Object.entries(schema)`: src/tools/extract.ts:83.
- FAIL — Uses `htmlToMarkdown`, but missing required `stripNoiseElements`: src/tools/extract.ts:80, src/utils.ts:21.
- PASS — Truncates content to 50K chars: src/tools/extract.ts:81.
- PASS — Heuristic mode still returns `mode: "heuristic"`: src/tools/extract.ts:126.
- PARTIAL — Schema validation covers object, 1-20 fields, and string values, but not safe keys or whitespace-only descriptions: src/tools/extract.ts:430.
- PASS — MCP inputSchema includes `schema`; `required` is `["url"]`: src/index.ts:135, src/index.ts:142.
- PASS — render fallback feeds `html` before schema branching, so schema mode can use rendered HTML: src/tools/extract.ts:62, src/tools/extract.ts:78.
- PARTIAL — Tests cover shape, prompt, truncation, validation, and backward compatibility, but not actual render fallback escalation. The render fallback test passes `render_fallback: false`: src/__tests__/extract.test.ts:548.
- PARTIAL — No UI HTML injection is apparent, but schema keys can inject prompt structure.

## What's Good
- Schema mode is small and preserves the existing heuristic path.
- The response includes the requested core fields and `content_length`.
- `fields` is optional when `schema` is present.
- CLI `--schema` integration routes through the validator.
- `npx tsc --noEmit` passed — no type errors.

## Suggestions
- Make the schema-mode `tool` field match the registered tool name (`agentproxy_extract`, not `novada_proxy_extract`).
- Add real noise stripping (nav, header, footer, aside) before markdown conversion, as the design spec requires.
- Add a test that mocks fetch failure and verifies schema mode works after render fallback.
- Validate schema keys with a conservative field-name pattern (e.g., `/^[a-zA-Z_][a-zA-Z0-9_ ]{0,63}$/`).
- Use `v.trim().length` instead of `v.length` when validating schema description values.
- Note: build and test commands could not be verified in sandbox due to EPERM errors writing to `build/` and `node_modules/.vite-temp/`.
