# Novada Proxy Monorepo Split — Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split novada-proxy-mcp@1.8.2 from a single package into a monorepo with @novada/proxy-core, @novada/proxy-mcp, @novada/proxy-cli, plus backward-compat meta-package.

**Architecture:** npm workspaces monorepo. Core contains all shared logic (adapters, tools, types). MCP and CLI are thin wrappers that import from core. Compat package re-exports for backward compatibility.

**Tech Stack:** TypeScript 5.3+, npm workspaces, vitest, @changesets/cli

**Spec:** `~/Projects/novada-proxy/docs/superpowers/specs/2026-05-04-proxy-product-ecosystem-design.md`
**Prompts:** `~/Projects/agentproxy/docs/prompts/`
**Project:** `~/Projects/agentproxy/`

---

## Agent Architecture

```
Orchestrator (Opus 4.6) — YOU
├── Worker A (Sonnet 4.6, Claude Code) — core extraction
├── Worker B (Codex) — MCP + CLI + compat extraction
├── Reviewer A (Sonnet 4.6) — reviews Worker B's output
├── Reviewer B (Codex) — reviews Worker A's output
└── Verifier (Sonnet 4.6) — build + test + smoke test
```

**Model rules:**
- Opus 4.6: orchestrator ONLY
- Sonnet 4.6: workers, reviewers, verifier in Claude Code
- Codex: parallel worker, cross-reviewer
- Haiku: quick lookups if needed

## Naming Convention (Agent-Navigable)

Tool name → file path mapping (1:1, derivable):

| Tool name | Function | File |
|-----------|----------|------|
| `novada_proxy_fetch` | `novadaProxyFetch` | `packages/core/src/tools/fetch.ts` |
| `novada_proxy_batch_fetch` | `novadaProxyBatchFetch` | `packages/core/src/tools/batch.ts` |
| `novada_proxy_search` | `novadaProxySearch` | `packages/core/src/tools/search.ts` |
| `novada_proxy_extract` | `novadaProxyExtract` | `packages/core/src/tools/extract.ts` |
| `novada_proxy_map` | `novadaProxyMap` | `packages/core/src/tools/map.ts` |
| `novada_proxy_crawl` | `novadaProxyCrawl` | `packages/core/src/tools/crawl.ts` |
| `novada_proxy_research` | `novadaProxyResearch` | `packages/core/src/tools/research.ts` |
| `novada_proxy_render` | `novadaProxyRender` | `packages/core/src/tools/render.ts` |
| `novada_proxy_session` | `novadaProxySession` | `packages/core/src/tools/session.ts` |
| `novada_proxy_status` | `novadaProxyStatus` | `packages/core/src/tools/status.ts` |

**Package mapping:**
| Package | npm name | Directory | Purpose |
|---------|----------|-----------|---------|
| Core | `@novada/proxy-core` | `packages/core/` | Engine: adapters, tools, types |
| MCP | `@novada/proxy-mcp` | `packages/mcp/` | MCP server: schemas, handlers |
| CLI | `@novada/proxy-cli` | `packages/cli/` | CLI: arg parsing, output |
| Compat | `novada-proxy-mcp` | `packages/compat/` | Backward compat meta-package |

**Test mapping:**
| Test file | Package | Tests for |
|-----------|---------|-----------|
| `adapters.test.ts` | core | Adapter resolution + providers |
| `cache.test.ts` | core | In-process cache |
| `classifyError.test.ts` | core | Error classification |
| `crawl.test.ts` | core | Crawl tool |
| `extract.test.ts` | core | Extract tool |
| `extractHelpers.test.ts` | core | Extract utility functions |
| `map.test.ts` | core | Map tool |
| `ratelimit.test.ts` | core | Rate limiting |
| `research.test.ts` | core | Research tool |
| `session.test.ts` | core | Session tool |
| `status.test.ts` | core | Status tool |
| `utils.test.ts` | core | Utility functions |
| `validators.test.ts` | core | Input validation |
| `mcp.test.ts` | mcp | MCP server registration |
| `cli.test.ts` | cli | CLI arg parsing + dispatch |

---

## Loop 1: Foundation Split

**Goal:** All code in correct packages, all tests pass, builds clean.

### Task 1: Workspace Infrastructure

**Agent:** Worker A (Sonnet, Claude Code)
**Prompt:** `docs/prompts/worker-core-extraction.md`

**Files:**
- Create: `tsconfig.base.json`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts` (barrel)
- Modify: root `package.json` (add workspaces)
- Copy: all core source files to `packages/core/src/`
- Copy: 13 test files to `packages/core/__tests__/`

- [ ] **Step 1: Read existing tsconfig.json to match compiler options**

```bash
cat ~/Projects/agentproxy/tsconfig.json
```

- [ ] **Step 2: Create tsconfig.base.json at root**

Match the existing compiler options. This is the shared base for all packages.

- [ ] **Step 3: Create packages/core/ directory structure**

```bash
mkdir -p packages/core/src/adapters packages/core/src/tools packages/core/__tests__
```

- [ ] **Step 4: Create packages/core/package.json**

See `docs/prompts/worker-core-extraction.md` for exact content.

- [ ] **Step 5: Create packages/core/tsconfig.json**

Extends `../../tsconfig.base.json`, outDir `build`, rootDir `src`.

- [ ] **Step 6: Copy adapter files to packages/core/src/adapters/**

```bash
cp src/adapters/*.ts packages/core/src/adapters/
```

- [ ] **Step 7: Copy tool files to packages/core/src/tools/**

```bash
cp src/tools/*.ts packages/core/src/tools/
```

- [ ] **Step 8: Copy utility files to packages/core/src/**

```bash
cp src/config.ts src/types.ts src/errors.ts src/utils.ts src/validation.ts src/redact.ts packages/core/src/
```

- [ ] **Step 9: Create packages/core/src/index.ts barrel export**

Read `src/tools/index.ts`, `src/adapters/index.ts`, `src/validation.ts`, `src/redact.ts` to determine all exports. Create barrel that re-exports everything needed by MCP and CLI.

- [ ] **Step 10: Copy test files to packages/core/__tests__/**

```bash
for f in src/__tests__/*.test.ts; do
  base=$(basename "$f")
  case "$base" in
    mcp.test.ts|cli.test.ts) ;; # skip
    *) cp "$f" packages/core/__tests__/ ;;
  esac
done
```

- [ ] **Step 11: Fix test import paths in packages/core/__tests__/**

Each test file imports from paths like `"../tools/fetch.js"`. Update to `"../src/tools/fetch.js"` since tests are now one level deeper relative to source.

Read each of the 13 test files, find all import statements, and update paths:
- `"../tools/X.js"` → `"../src/tools/X.js"`
- `"../adapters/X.js"` → `"../src/adapters/X.js"`
- `"../errors.js"` → `"../src/errors.js"`
- `"../utils.js"` → `"../src/utils.js"`
- `"../types.js"` → `"../src/types.js"`
- `"../config.js"` → `"../src/config.js"`
- `"../validation.js"` → `"../src/validation.js"`
- `"../redact.js"` → `"../src/redact.js"`

- [ ] **Step 12: Verify core package builds**

```bash
cd ~/Projects/agentproxy/packages/core && npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 13: Commit core extraction**

```bash
cd ~/Projects/agentproxy
git add packages/core/ tsconfig.base.json
git commit -m "feat: extract @novada/proxy-core package"
```

### Task 2: MCP Package Extraction

**Agent:** Worker B (Codex)
**Prompt:** `docs/prompts/worker-mcp-cli-extraction.md`

**Files:**
- Create: `packages/mcp/package.json`
- Create: `packages/mcp/tsconfig.json`
- Create: `packages/mcp/src/index.ts` (from src/index.ts with updated imports)
- Create: `packages/mcp/__tests__/mcp.test.ts`

- [ ] **Step 1: Create packages/mcp/ directory structure**

```bash
mkdir -p packages/mcp/src packages/mcp/__tests__
```

- [ ] **Step 2: Create packages/mcp/package.json**

See `docs/prompts/worker-mcp-cli-extraction.md` for exact content.

- [ ] **Step 3: Create packages/mcp/tsconfig.json**

Extends `../../tsconfig.base.json`, outDir `build`, rootDir `src`.

- [ ] **Step 4: Copy src/index.ts to packages/mcp/src/index.ts and rewrite imports**

Read `src/index.ts` completely. Copy to `packages/mcp/src/index.ts`. Replace ALL imports from relative paths to `@novada/proxy-core`:

```typescript
// Replace these patterns:
// from "./tools/index.js"  →  from "@novada/proxy-core"
// from "./adapters/index.js"  →  from "@novada/proxy-core"
// from "./config.js"  →  from "@novada/proxy-core"
// from "./errors.js"  →  from "@novada/proxy-core"
// from "./types.js"  →  from "@novada/proxy-core"
```

IMPORTANT: Keep the `export { classifyError } from ...` line updated too.

IMPORTANT: The TOOLS array with all inputSchema definitions stays in this file. These are MCP-specific schema definitions.

- [ ] **Step 5: Copy and fix mcp.test.ts**

```bash
cp src/__tests__/mcp.test.ts packages/mcp/__tests__/
```

Update imports in the test file to reference the new package paths.

- [ ] **Step 6: Verify MCP package builds**

```bash
cd ~/Projects/agentproxy && npm install && cd packages/mcp && npx tsc --noEmit
```

- [ ] **Step 7: Commit MCP extraction**

```bash
cd ~/Projects/agentproxy
git add packages/mcp/
git commit -m "feat: extract @novada/proxy-mcp package"
```

### Task 3: CLI Package Extraction

**Agent:** Worker B (Codex) — continues from Task 2
**Prompt:** `docs/prompts/worker-mcp-cli-extraction.md`

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/cli.ts` (from src/cli.ts with updated imports)
- Create: `packages/cli/__tests__/cli.test.ts`

- [ ] **Step 1: Create packages/cli/ directory structure**

```bash
mkdir -p packages/cli/src packages/cli/__tests__
```

- [ ] **Step 2: Create packages/cli/package.json**

See prompt for exact content.

- [ ] **Step 3: Create packages/cli/tsconfig.json**

- [ ] **Step 4: Copy src/cli.ts to packages/cli/src/cli.ts and rewrite imports**

Same pattern as MCP: all relative imports → `@novada/proxy-core`.

- [ ] **Step 5: Copy and fix cli.test.ts**

- [ ] **Step 6: Verify CLI package builds**

- [ ] **Step 7: Commit CLI extraction**

```bash
git add packages/cli/
git commit -m "feat: extract @novada/proxy-cli package"
```

### Task 4: Compat Package + Workspace Root

**Agent:** Worker B (Codex) — continues

**Files:**
- Create: `packages/compat/package.json`
- Modify: root `package.json`

- [ ] **Step 1: Create packages/compat/package.json**

See prompt for exact content.

- [ ] **Step 2: Modify root package.json**

Transform from a publishable package to a workspace root:

```json
{
  "name": "novada-proxy-workspace",
  "private": true,
  "workspaces": [
    "packages/core",
    "packages/mcp",
    "packages/cli",
    "packages/compat"
  ],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "clean": "rm -rf packages/*/build"
  }
}
```

IMPORTANT: Save the old package.json to `package.json.bak` first. We need it for reference.

- [ ] **Step 3: Install workspace dependencies**

```bash
cd ~/Projects/agentproxy && rm -rf node_modules && npm install
```

- [ ] **Step 4: Build all packages**

```bash
npm run build
```

Expected: All 3 packages build (core first, then mcp + cli).

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: All 452+ tests pass across all packages.

- [ ] **Step 6: Commit workspace setup**

```bash
git add package.json tsconfig.base.json packages/compat/
git commit -m "feat: monorepo workspace with core, mcp, cli, compat"
```

### Task 5: Cross-Review

**Agents:**
- Reviewer A (Sonnet, Claude Code): Reviews Tasks 2-4 (Codex's work)
- Reviewer B (Codex): Reviews Task 1 (Claude Code's work)

**Prompt:** `docs/prompts/reviewer-cross.md`

- [ ] **Step 1: Dispatch Reviewer A** — reviews packages/mcp/, packages/cli/, packages/compat/, root package.json
- [ ] **Step 2: Dispatch Reviewer B** — reviews packages/core/
- [ ] **Step 3: Collect review reports**
- [ ] **Step 4: If CRITICAL/HIGH issues found, dispatch fix agent**
- [ ] **Step 5: Re-verify after fixes**

### Task 6: Verification

**Agent:** Verifier (Sonnet)
**Prompt:** `docs/prompts/verifier.md`

- [ ] **Step 1: Run full verification checklist**

```bash
cd ~/Projects/agentproxy
npm install
npm run build
npm test
```

- [ ] **Step 2: Agent navigation test**

```bash
for tool in fetch batch search extract map crawl research render session status; do
  test -f "packages/core/src/tools/$tool.ts" && echo "OK: $tool" || echo "FAIL: $tool"
done
```

- [ ] **Step 3: Stale import audit**

```bash
grep -rn 'from "\./tools/' packages/mcp/src/ packages/cli/src/ 2>/dev/null
grep -rn 'from "\./adapters/' packages/mcp/src/ packages/cli/src/ 2>/dev/null
```

Expected: No matches (all should be @novada/proxy-core).

- [ ] **Step 4: Report results**

### Task 7: Functional Test

**Agent:** Verifier (Sonnet)

- [ ] **Step 1: Test MCP server starts**

```bash
cd ~/Projects/agentproxy
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | timeout 5 node packages/mcp/build/index.js 2>/dev/null | head -5
```

Expected: JSON-RPC response with server capabilities.

- [ ] **Step 2: Test CLI responds to --help**

```bash
node packages/cli/build/cli.js --help
```

Expected: Usage text with available commands.

- [ ] **Step 3: Test CLI version**

```bash
node packages/cli/build/cli.js --version
```

Expected: Version number output.

---

## Loop 2: Polish + Quality (if Loop 1 has issues)

**Goal:** Fix all issues from Loop 1 cross-review. Ensure naming consistency, documentation, and agent navigability.

### Task 8: Fix Loop 1 Issues

Based on reviewer reports. Agent fixes each CRITICAL/HIGH issue.

### Task 9: Clean Up Old src/

After confirming all packages work:

- [ ] **Step 1: Move old src/ to src.bak/**

```bash
mv src src.bak
```

- [ ] **Step 2: Verify builds still pass** (packages/ don't depend on src/)

- [ ] **Step 3: If pass, delete src.bak/**

- [ ] **Step 4: Update .gitignore, README, SKILL.md references**

### Task 10: Package README Files

Each package gets a focused README:

- [ ] **Step 1: packages/core/README.md** — lists all tools, types, adapter interface
- [ ] **Step 2: packages/mcp/README.md** — MCP setup instructions, tool schemas, env vars
- [ ] **Step 3: packages/cli/README.md** — CLI usage, command reference
- [ ] **Step 4: Root README.md** — monorepo overview, links to packages

### Task 11: Cross-Review + Verify (Loop 2)

Same protocol as Loop 1 Tasks 5-7.

---

## Loop 3: Publish Readiness (if approved)

**Goal:** All packages ready for npm publish under @novada scope.

### Task 12: npm Org + Changeset Setup

- [ ] **Step 1: Document @novada npm org creation** (requires manual step)
- [ ] **Step 2: Install @changesets/cli**

```bash
npm install -D @changesets/cli
npx changeset init
```

- [ ] **Step 3: Configure .changeset/config.json** for independent versioning

### Task 13: Publish Dry Run

- [ ] **Step 1: Run npm pack for each package**

```bash
cd packages/core && npm pack --dry-run
cd packages/mcp && npm pack --dry-run
cd packages/cli && npm pack --dry-run
```

- [ ] **Step 2: Verify package contents** — no test files, no source maps in published package

### Task 14: Final Cross-Review + Verify (Loop 3)

---

## Loop Exit Criteria

Each loop ends when ALL of these are true:

| Criterion | Check command |
|-----------|--------------|
| All tests pass | `npm test` — 452+ pass, 0 fail |
| Zero TS errors | `npm run build` — no errors |
| Agent navigation | Tool name → file path in 1 step |
| No stale imports | `grep -r 'from "\./tools/' packages/mcp/ packages/cli/` returns nothing |
| Backward compat | `node packages/mcp/build/index.js` starts, `node packages/cli/build/cli.js --help` works |
| Reviewer PASS | No CRITICAL or HIGH issues from cross-review |

## Maximum Loops: 5

If not converged by Loop 5, report to user with remaining issues.

---

## Orchestrator Dispatch Reference

### Dispatch Worker (Claude Code, Sonnet)

```
Agent(
  description: "Worker A: core extraction",
  model: "sonnet",
  prompt: "<read docs/prompts/worker-core-extraction.md and execute>"
)
```

### Dispatch Worker (Codex)

```
Agent(
  subagent_type: "codex:codex-rescue",
  description: "Worker B: MCP+CLI extraction",
  prompt: "<read docs/prompts/worker-mcp-cli-extraction.md and execute>"
)
```

### Dispatch Reviewer

```
Agent(
  description: "Reviewer A: cross-review Codex output",
  model: "sonnet",
  prompt: "<read docs/prompts/reviewer-cross.md, review packages/mcp/ and packages/cli/>"
)
```

### Dispatch Verifier

```
Agent(
  description: "Verifier: build + test + smoke",
  model: "sonnet",
  prompt: "<read docs/prompts/verifier.md and run full checklist>"
)
```
