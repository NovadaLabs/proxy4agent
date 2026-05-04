# Worker: MCP + CLI Package Extraction

**Model:** Codex (or Sonnet 4.6)
**Role:** Extract MCP server and CLI into their own packages

## Objective

Create `packages/mcp/` and `packages/cli/` packages. Each depends on `@novada/proxy-core`. The MCP package contains the MCP server (tool schemas, handlers, transport). The CLI package contains arg parsing and tool dispatch. Create the backward-compat meta-package.

## Project Location

`~/Projects/agentproxy/`

## Prerequisite

`packages/core/` must exist and build (Worker A completes first).

## Steps

### 1. Create MCP package: packages/mcp/

**packages/mcp/package.json:**
```json
{
  "name": "@novada/proxy-mcp",
  "version": "1.0.0",
  "description": "Novada Proxy MCP server — residential proxy tools for AI agents",
  "type": "module",
  "main": "build/index.js",
  "types": "build/index.d.ts",
  "bin": {
    "novada-proxy-mcp": "build/index.js"
  },
  "files": ["build/**/*.js", "build/**/*.d.ts", "README.md"],
  "scripts": {
    "build": "tsc && node --input-type=commonjs -e \"require('fs').chmodSync('build/index.js', '755')\"",
    "test": "vitest run"
  },
  "dependencies": {
    "@novada/proxy-core": "*",
    "@modelcontextprotocol/sdk": "^1.26.0"
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

**packages/mcp/tsconfig.json:**
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

**packages/mcp/src/index.ts:**
Copy the full content of `src/index.ts` (922 lines) but change all imports to use `@novada/proxy-core`:

```typescript
// BEFORE (in src/index.ts):
import { novadaProxyFetch, validateFetchParams, ... } from "./tools/index.js";
import { resolveAdapter, listAdapters } from "./adapters/index.js";
import { VERSION, NPM_PACKAGE } from "./config.js";
import { classifyError } from "./errors.js";
import type { ProxyErrorResponse } from "./types.js";

// AFTER (in packages/mcp/src/index.ts):
import {
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
  resolveAdapter, listAdapters,
  VERSION, NPM_PACKAGE,
  classifyError,
} from "@novada/proxy-core";
import type { ProxyErrorResponse } from "@novada/proxy-core";
```

Keep ALL tool schema definitions (the TOOLS array), MCP handlers, server class, and startup logic exactly as-is. Only change the import paths.

**packages/mcp/__tests__/mcp.test.ts:**
Copy `src/__tests__/mcp.test.ts`, update imports to use `@novada/proxy-core` or relative `../src/index.js`.

### 2. Create CLI package: packages/cli/

**packages/cli/package.json:**
```json
{
  "name": "@novada/proxy-cli",
  "version": "1.0.0",
  "description": "Novada Proxy CLI — residential proxy commands for terminal",
  "type": "module",
  "main": "build/cli.js",
  "bin": {
    "novada-proxy": "build/cli.js"
  },
  "files": ["build/**/*.js", "build/**/*.d.ts", "README.md"],
  "scripts": {
    "build": "tsc && node --input-type=commonjs -e \"require('fs').chmodSync('build/cli.js', '755')\"",
    "test": "vitest run"
  },
  "dependencies": {
    "@novada/proxy-core": "*"
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

**packages/cli/tsconfig.json:**
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

**packages/cli/src/cli.ts:**
Copy `src/cli.ts` (745 lines), change imports:

```typescript
// BEFORE:
import { resolveAdapter, listAdapters } from "./adapters/index.js";
import { novadaProxyFetch, ... } from "./tools/index.js";
import { classifyError } from "./errors.js";
import { VERSION, NPM_PACKAGE } from "./config.js";
import type { ProxyErrorResponse } from "./types.js";

// AFTER:
import {
  resolveAdapter, listAdapters,
  novadaProxyFetch, validateFetchParams,
  novadaProxyBatchFetch, validateBatchFetchParams,
  novadaProxySearch, validateSearchParams,
  novadaProxyExtract, validateExtractParams,
  novadaProxyMap, validateMapParams,
  novadaProxyCrawl, validateCrawlParams,
  novadaProxyResearch, validateResearchParams,
  novadaProxyRender, validateRenderParams,
  novadaProxySession, validateSessionParams,
  novadaProxyStatus,
  classifyError, VERSION, NPM_PACKAGE,
} from "@novada/proxy-core";
import type { ProxyErrorResponse } from "@novada/proxy-core";
```

**packages/cli/__tests__/cli.test.ts:**
Copy `src/__tests__/cli.test.ts`, update imports.

### 3. Create backward-compat meta-package: packages/compat/

**packages/compat/package.json:**
```json
{
  "name": "novada-proxy-mcp",
  "version": "2.0.0",
  "description": "Novada Proxy — residential proxy MCP server for AI agents. Bypass Cloudflare/Akamai, geo-target 195+ countries, sticky sessions, Google search. Multi-provider: Novada, BrightData, Smartproxy, Oxylabs.",
  "type": "module",
  "bin": {
    "novada-proxy-mcp": "./node_modules/@novada/proxy-mcp/build/index.js",
    "novada-proxy": "./node_modules/@novada/proxy-cli/build/cli.js"
  },
  "dependencies": {
    "@novada/proxy-mcp": "*",
    "@novada/proxy-cli": "*"
  },
  "keywords": ["mcp", "proxy", "residential-proxy", "ai-agent", "novada"],
  "license": "MIT"
}
```

### 4. Create workspace root config

**Root package.json** (modify existing):
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
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "clean": "rm -rf packages/*/build"
  }
}
```

**tsconfig.base.json** (create at root):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": false,
    "sourceMap": false,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
  }
}
```

## Success Criteria

- `packages/mcp/` contains the MCP server, depends on `@novada/proxy-core`
- `packages/cli/` contains the CLI, depends on `@novada/proxy-core`
- `packages/compat/` re-exports both for backward compatibility
- `npm install` at root resolves workspace dependencies
- `npm run build --workspaces` builds all 3 packages with zero errors
- `npm run test --workspaces` runs all tests and passes

## Constraints

- Do NOT modify any tool logic — only import paths change
- Do NOT add new features or refactor code
- Do NOT delete the original `src/` directory yet (that's a cleanup task)
- Keep the tool schemas (TOOLS array) exactly as they are in index.ts
- The shebang `#!/usr/bin/env node` must be first line of mcp/src/index.ts and cli/src/cli.ts
