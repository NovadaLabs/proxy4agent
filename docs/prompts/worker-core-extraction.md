# Worker: Core Package Extraction

**Model:** Sonnet 4.6
**Role:** Extract shared proxy logic into `packages/core/`

## Objective

Move all shared proxy logic (adapters, tools, types, errors, utils) from the flat `src/` into `packages/core/src/`. Create the core package.json, tsconfig.json, and barrel index.ts. Move all non-MCP/CLI tests into `packages/core/__tests__/`.

## Project Location

`~/Projects/agentproxy/`

## Current Structure

```
src/
  index.ts          (922 lines — MCP server, DO NOT TOUCH)
  cli.ts            (745 lines — CLI, DO NOT TOUCH)
  config.ts         → move to core
  types.ts          → move to core
  errors.ts         → move to core
  utils.ts          → move to core
  validation.ts     → move to core
  redact.ts         → move to core
  adapters/         → move entire dir to core
  tools/            → move entire dir to core
  __tests__/        → split: mcp.test.ts stays, cli.test.ts stays, everything else → core
```

## Steps

### 1. Create package directories

```bash
mkdir -p packages/core/src/adapters packages/core/src/tools packages/core/__tests__
```

### 2. Create packages/core/package.json

```json
{
  "name": "@novada/proxy-core",
  "version": "1.0.0",
  "description": "Core proxy engine — adapters, tools, types for Novada Proxy",
  "type": "module",
  "main": "build/index.js",
  "types": "build/index.d.ts",
  "exports": {
    ".": {
      "types": "./build/index.d.ts",
      "import": "./build/index.js"
    },
    "./tools": {
      "types": "./build/tools/index.d.ts",
      "import": "./build/tools/index.js"
    },
    "./adapters": {
      "types": "./build/adapters/index.d.ts",
      "import": "./build/adapters/index.js"
    },
    "./errors": {
      "types": "./build/errors.d.ts",
      "import": "./build/errors.js"
    }
  },
  "files": ["build/**/*.js", "build/**/*.d.ts", "README.md"],
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "axios": "^1.7.0",
    "http-proxy-agent": "^7.0.0",
    "https-proxy-agent": "^9.0.0",
    "puppeteer-core": "^22.15.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.24",
    "typescript": "^5.3.3",
    "vitest": "^4.1.4"
  },
  "engines": { "node": ">=18.0.0" },
  "license": "MIT"
}
```

### 3. Create packages/core/tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "build",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["__tests__"]
}
```

### 4. Move files

```bash
# Adapters
cp src/adapters/*.ts packages/core/src/adapters/

# Tools
cp src/tools/*.ts packages/core/src/tools/

# Core utilities
cp src/config.ts src/types.ts src/errors.ts src/utils.ts src/validation.ts src/redact.ts packages/core/src/

# Tests (everything except mcp.test.ts and cli.test.ts)
for f in src/__tests__/*.test.ts; do
  base=$(basename "$f")
  if [[ "$base" != "mcp.test.ts" && "$base" != "cli.test.ts" ]]; then
    cp "$f" packages/core/__tests__/
  fi
done
```

### 5. Create packages/core/src/index.ts (barrel export)

```typescript
// Adapters
export { resolveAdapter, listAdapters } from "./adapters/index.js";
export type { ProxyAdapter, ProxyContext, ProxyCredentials } from "./adapters/types.js";

// Tools
export {
  novadaProxyFetch, validateFetchParams,
  novadaProxyBatchFetch, validateBatchFetchParams,
  novadaProxySearch, validateSearchParams,
  novadaProxySession, validateSessionParams,
  novadaProxyRender, validateRenderParams,
  novadaProxyExtract, validateExtractParams,
  novadaProxyMap, validateMapParams,
  novadaProxyCrawl, validateCrawlParams,
  novadaProxyResearch, validateResearchParams,
  novadaProxyStatus,
} from "./tools/index.js";
export type {
  FetchParams, BatchFetchParams, BatchFetchResult,
  SearchParams, SessionParams, RenderParams,
  ExtractParams, MapParams, CrawlParams, ResearchParams,
} from "./tools/index.js";

// Core utilities
export { classifyError } from "./errors.js";
export { VERSION, NPM_PACKAGE } from "./config.js";
export type { ProxyErrorResponse } from "./types.js";

// Validation + Redaction
export { validateUrl, validateCountry } from "./validation.js";
export { redactCredentials } from "./redact.js";
```

NOTE: The exact exports depend on what validation.ts and redact.ts actually export. Read those files and adjust the barrel accordingly.

### 6. Fix import paths in core tests

All test files in `packages/core/__tests__/` currently import from relative paths like `"../tools/fetch.js"`. Update these to import from the core package's source:

- `"../tools/fetch.js"` → `"../src/tools/fetch.js"`
- `"../errors.js"` → `"../src/errors.js"`
- etc.

Read each test file, find all imports, update paths.

## Success Criteria

- `packages/core/` contains all adapters, tools, types, errors, utils, validation, redact
- `packages/core/__tests__/` contains 13 test files (everything except mcp.test.ts, cli.test.ts)
- `packages/core/src/index.ts` barrel exports all public APIs
- `cd packages/core && npx tsc --noEmit` passes with zero errors
- Original `src/` files remain untouched (they get modified in a later task)

## Constraints

- Do NOT modify `src/index.ts` or `src/cli.ts`
- Do NOT delete any original `src/` files yet
- Do NOT install dependencies — workspace linking handles this
- Do NOT rename any functions or types
