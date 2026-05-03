# A/B Test Round 2 — Content Quality Comparison

## Metrics

| Metric | Claude Code | Codex | Winner |
|--------|:-----------:|:-----:|:------:|
| **Tokens** | 47K | **20K** | **Codex** (2.4x cheaper) |
| **Tool calls** | 15 | 1 | Codex |
| **Duration** | **137s** | 217s | **Claude** (1.6x faster) |
| **New tests** | **24** | 8 | **Claude** (3x more) |
| **Tests pass** | 386 | 315 | Claude (more total) |
| **Build** | pass | pass | Tie |

## Approach Difference

**Claude Code:** Read utils.ts, designed stripNoiseElements with depth-based tag matching and NOISE_ATTR_PATTERN regex, wrote countHtmlTags and contentDensity helpers, added 24 targeted tests covering edge cases (nested noise, real content preservation, hidden elements).

**Codex:** Used Codex CLI to implement similar logic but simpler regex approach, fewer tests (8), faster but less thorough.

## Quality Comparison

Both produced working implementations. Key differences:
- Claude's noise removal handles nested elements with depth tracking (more robust)
- Codex's approach uses simpler greedy regex (faster but can break on nested noise)
- Claude added 3x more tests covering edge cases
- Both added content_density to response meta

## Verdict

**Round 2 winner: Claude Code** — for creative/context-sensitive tasks (algorithm design, edge case handling, test coverage), Claude's granular approach produces more robust results.

## A/B Test Summary (2 rounds)

| Task Type | Winner | Why |
|-----------|:------:|-----|
| Bulk rename/refactor | **Codex** | 8x cheaper, bulk sed approach, catches more files |
| Creative/algorithm design | **Claude Code** | Better edge case handling, 3x more tests, context-aware |

**Recommendation:** Use Codex for mechanical tasks (rename, format, migrate). Use Claude Code for design tasks (new features, algorithms, quality improvements).
