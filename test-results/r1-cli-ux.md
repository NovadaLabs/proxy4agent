# R1: CLI UX, Help Text, Output Formatting

**Date:** 2026-04-27
**Version:** 1.7.6
**Tester:** Round 1 — CLI UX quality

| Test | What | Expected | Actual | PASS/FAIL |
|------|------|----------|--------|-----------|
| T1 | Global `--help` | Lists all commands, options, env vars | All 9 commands listed with descriptions, 3 options (`--help`, `--version`, `--human`), 4 env vars, install hint. Clean layout. | **PASS** |
| T2a | `fetch --help` | Shows usage, options | 6 options listed (`--country`, `--city`, `--session_id`, `--format`, `--timeout`, `--human`). Clear syntax line. | **PASS** |
| T2b | `crawl --help` | Shows usage, options | 7 options listed (`--depth`, `--limit`, `--include_content`, `--country`, `--timeout`, `--format`, `--human`). | **PASS** |
| T2c | `extract --help` | Shows usage, options | 6 options listed. `--fields` shown as required with example. `--render_fallback` documented. | **PASS** |
| T3 | `--version` | Prints version number | `1.7.6` (single line, no extra noise) | **PASS** |
| T4 | `status --human` | Pretty-printed, human-readable output | ANSI color codes present (cyan header, green OK, yellow latency). Structured layout with labels (`provider`, `version`, `capabilities`, `connectivity`). Credits shown. Latency 5461ms. | **PASS** |
| T5 | JSON parseable via `python3 json.load` | Valid JSON with `ok` and `tool` fields | `VALID JSON, ok=True tool=agentproxy_fetch`. Python successfully parsed stdout. | **PASS** |
| T6 | Unknown command `nonexistent` | Error with guidance | Exit code 1. JSON error: `code: "INVALID_INPUT"`, `message: "Unknown command: nonexistent"`, `agent_instruction: "Run: novada-proxy --help for available commands."` | **PASS** |
| T7 | All 9 tools in help | 9 commands: fetch, batch, search, extract, map, crawl, render, session, status | All 9 present. Each verified individually with `grep -c`. | **PASS** |

## Edge Cases (Bonus)

| Test | What | Actual | PASS/FAIL |
|------|------|--------|-----------|
| E1 | No arguments at all | Shows global help (same as `--help`). Exit code 1. | **PASS** |
| E2 | `fetch` without URL | JSON error: `code: "INVALID_INPUT"`, `message: "Missing required argument: <url>"`, `agent_instruction: "Run: novada-proxy fetch --help for usage."` Exit code 2. | **PASS** |

## Summary

**9/9 required tests PASS. 2/2 edge cases PASS.**

### Strengths

1. **Agent-optimized error format:** Every error includes `code`, `message`, `recoverable`, and `agent_instruction`. The `agent_instruction` field tells the LLM exactly what to do next — this is best-in-class for MCP tools.
2. **Clean separation of JSON vs human output:** Default is machine-parseable JSON on stdout. `--human` adds ANSI colors and structured layout. No mixing of formats.
3. **Consistent exit codes:** 0 = success, 1 = usage/help, 2 = input validation error. Clean for scripting.
4. **Global help is well-organized:** Commands section with aligned descriptions, Options section, Environment section, Install hint. All in ~20 lines.
5. **Subcommand help is complete:** Each subcommand shows its own options with types, defaults, and examples (e.g., `--fields title,price,description`).
6. **Version output is clean:** Just `1.7.6`, no banner or noise — ideal for `$(novada-proxy --version)` usage.

### Issues Found

None. CLI UX is production-quality.

### Minor Suggestions (Not Bugs)

1. **`-h` shorthand works for `--help`** but subcommands don't document `-h` in their own help text (they only show `--human`). Not a real issue since `-h` is passed through from the global parser.
2. **No `--json` flag:** The default is already JSON, but some CLIs offer an explicit `--json` flag for symmetry with `--human`. Low priority since the default behavior is correct.
