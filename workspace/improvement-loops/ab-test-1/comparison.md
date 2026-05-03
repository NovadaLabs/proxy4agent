# A/B Test Round 1 — Rename Comparison

## Metrics

| Metric | Codex | Claude Code | Winner |
|--------|:-----:|:-----------:|:------:|
| **Tokens used** | 21,159 | 165,371 | **Codex** (8x cheaper) |
| **Tool calls** | 1 | 253 | **Codex** (bulk approach) |
| **Duration** | 187s (3.1 min) | 482s (8.0 min) | **Codex** (2.6x faster) |
| **Files modified** | 61 | 30+ | **Codex** (more thorough) |
| **Tests pass** | 307/307 | 307/307 | Tie |
| **Core grep residuals** | 0 | 0 | Tie |
| **Broader residuals** | 33 (.smithery/) | 8 (docs/) | **Claude** (fewer misses) |

## Approach Difference

**Codex:** Single bash command with sed — bulk find-and-replace across all files. Fast, cheap, comprehensive for source files. But missed `.smithery/shttp/module.js` (a compiled/bundled file that should be regenerated, not sed'd).

**Claude Code:** Granular Read→Edit per file, 253 tool calls. More expensive and slower, but understood file context. Caught CHANGELOG.md and docs/ references but chose not to change path references (`~/Projects/agentproxy/`), which is correct — those are filesystem paths, not product names.

## Residual Analysis

**Codex residuals (33):** All in `.smithery/shttp/module.js` — this is a BUILD ARTIFACT (compiled JS bundle from smithery). Codex correctly renamed all source files but didn't touch this pre-built bundle. The bundle needs to be regenerated from source, not manually edited. **This is correct behavior.**

**Claude residuals (8):** 
- `REVIEW_PROMPT.md` — references `agentproxy` as a repo path/URL (not a tool name). Correct to leave.
- `CHANGELOG.md` — historical entry about the rename. Correct to leave.
- `docs/review/REVIEW-AGENTS.md` — `~/Projects/agentproxy/` filesystem paths. Correct to leave.

## Verdict

**Both produced correct, working renames.** The residuals in both cases are intentional (build artifacts, historical docs, filesystem paths).

| Use case | Better choice | Why |
|----------|:------------:|-----|
| Bulk rename/refactor | **Codex** | 8x cheaper, 2.6x faster, catches more files |
| Context-sensitive edits | **Claude Code** | Understands what to change vs what to leave |
| Safety-critical changes | **Claude Code** | Reads before editing, less risk of over-applying |

## Recommendation

For this rename task: **merge Codex's worktree** — it touched more files (61 vs 30+), was faster, cheaper, and the .smithery residuals are build artifacts that should be regenerated anyway.

For future A/B tests: use Codex for bulk/mechanical tasks, Claude Code for nuanced/context-dependent tasks.
