#!/usr/bin/env node

import { parseArgs } from "node:util";
import { resolveAdapter, listAdapters } from "./adapters/index.js";
import {
  agentproxyFetch, validateFetchParams,
  agentproxyBatchFetch, validateBatchFetchParams,
  agentproxySearch, validateSearchParams,
  agentproxyExtract, validateExtractParams,
  agentproxyMap, validateMapParams,
  agentproxyRender, validateRenderParams,
  agentproxySession, validateSessionParams,
  agentproxyStatus,
} from "./tools/index.js";
import { classifyError } from "./errors.js";
import { VERSION, NPM_PACKAGE } from "./config.js";
import type { ProxyErrorResponse } from "./types.js";

// ─── Credential Resolution ──────────────────────────────────────────────────

const proxyContext = resolveAdapter(process.env);
const NOVADA_API_KEY = process.env.NOVADA_API_KEY;
const NOVADA_BROWSER_WS = process.env.NOVADA_BROWSER_WS;

// ─── Helpers ────────────────────────────────────────────────────────────────

function writeJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

function writeError(err: ProxyErrorResponse, exitCode: number = 1): never {
  process.stderr.write(JSON.stringify(err, null, 2) + "\n");
  process.exit(exitCode);
}

function redactMessage(msg: string): string {
  let redacted = msg;
  if (proxyContext) {
    for (const field of proxyContext.adapter.sensitiveFields) {
      const val = proxyContext.credentials[field];
      if (val) {
        redacted = redacted.replaceAll(val, "***");
        redacted = redacted.replaceAll(encodeURIComponent(val), "***");
      }
    }
    const user = proxyContext.credentials["user"];
    if (user) {
      redacted = redacted.replaceAll(user, "***");
      redacted = redacted.replaceAll(encodeURIComponent(user), "***");
    }
  }
  if (NOVADA_API_KEY) {
    redacted = redacted.replaceAll(NOVADA_API_KEY, "***");
    redacted = redacted.replaceAll(encodeURIComponent(NOVADA_API_KEY), "***");
  }
  if (NOVADA_BROWSER_WS) {
    redacted = redacted.replaceAll(NOVADA_BROWSER_WS, "***");
    redacted = redacted.replaceAll(encodeURIComponent(NOVADA_BROWSER_WS), "***");
  }
  return redacted;
}

function handleToolError(err: unknown): never {
  const errResponse = classifyError(err);
  errResponse.error.message = redactMessage(errResponse.error.message);
  writeError(errResponse, 1);
}

function missingProxyError(): never {
  const adapters = listAdapters();
  const providers = adapters
    .map(a => `  ${a.displayName}: ${a.credentialDocs}`)
    .join("\n");
  const errResp: ProxyErrorResponse = {
    ok: false,
    error: {
      code: "PROVIDER_NOT_CONFIGURED",
      message: "No proxy provider is configured.",
      recoverable: false,
      agent_instruction: [
        "Set credentials for one of the supported providers:",
        providers,
        "",
        `Recommended -- Novada: export NOVADA_PROXY_USER=your_username NOVADA_PROXY_PASS=your_password`,
      ].join("\n"),
    },
  };
  writeError(errResp, 1);
}

function missingApiKeyError(): never {
  const errResp: ProxyErrorResponse = {
    ok: false,
    error: {
      code: "PROVIDER_NOT_CONFIGURED",
      message: "NOVADA_API_KEY is not set (required for search).",
      recoverable: false,
      agent_instruction: `Get your API key at novada.com -> Dashboard -> API Keys. Then: export NOVADA_API_KEY=your_key`,
    },
  };
  writeError(errResp, 1);
}

function missingBrowserWsError(): never {
  const errResp: ProxyErrorResponse = {
    ok: false,
    error: {
      code: "PROVIDER_NOT_CONFIGURED",
      message: "NOVADA_BROWSER_WS is not set (required for render).",
      recoverable: false,
      agent_instruction: `Get your Browser API WebSocket URL at novada.com -> Dashboard -> Browser API. Then: export NOVADA_BROWSER_WS=your_wss_url`,
    },
  };
  writeError(errResp, 1);
}

function invalidArgs(subcommand: string, message: string): never {
  const errResp: ProxyErrorResponse = {
    ok: false,
    error: {
      code: "INVALID_INPUT",
      message,
      recoverable: false,
      agent_instruction: `Run: novada-proxy ${subcommand} --help for usage.`,
    },
  };
  process.stderr.write(JSON.stringify(errResp, null, 2) + "\n");
  process.exit(2);
}

// ─── Pretty Printer (--human) ───────────────────────────────────────────────

function prettyPrint(result: string): void {
  try {
    const parsed = JSON.parse(result) as Record<string, unknown>;
    const data = parsed.data as Record<string, unknown> | undefined;
    const meta = parsed.meta as Record<string, unknown> | undefined;

    // Tool name
    const tool = parsed.tool as string | undefined;
    if (tool) process.stdout.write(`\x1b[1;36m${tool}\x1b[0m\n`);

    // Status
    if (parsed.ok) {
      process.stdout.write(`\x1b[32m OK\x1b[0m`);
    } else {
      process.stdout.write(`\x1b[31m FAIL\x1b[0m`);
    }

    // Latency
    if (meta?.latency_ms) {
      process.stdout.write(`  \x1b[33m${meta.latency_ms}ms\x1b[0m`);
    }

    // Cache
    if (meta?.cache_hit) {
      process.stdout.write(`  \x1b[35m(cached)\x1b[0m`);
    }

    process.stdout.write("\n\n");

    // Data section
    if (data) {
      // If there's a content field, show it as the main body
      const content = data.content as string | undefined;
      if (content) {
        process.stdout.write(content.slice(0, 2000));
        if (content.length > 2000) process.stdout.write("\n\x1b[33m... truncated for display\x1b[0m");
        process.stdout.write("\n");
      } else {
        // Show all data fields as key: value
        for (const [key, val] of Object.entries(data)) {
          if (Array.isArray(val)) {
            process.stdout.write(`\x1b[1m${key}\x1b[0m (${val.length}):\n`);
            for (const item of val.slice(0, 20)) {
              if (typeof item === "object" && item !== null) {
                const obj = item as Record<string, unknown>;
                const title = obj.title || obj.url || "";
                process.stdout.write(`  - ${String(title)}\n`);
              } else {
                process.stdout.write(`  - ${String(item)}\n`);
              }
            }
            if (val.length > 20) process.stdout.write(`  ... and ${val.length - 20} more\n`);
          } else if (typeof val === "object" && val !== null) {
            process.stdout.write(`\x1b[1m${key}\x1b[0m: ${JSON.stringify(val, null, 2)}\n`);
          } else {
            process.stdout.write(`\x1b[1m${key}\x1b[0m: ${String(val)}\n`);
          }
        }
      }
    }

    // Quota
    if (meta?.quota) {
      const quota = meta.quota as Record<string, unknown>;
      process.stdout.write(`\n\x1b[2mCredits: ~${quota.credits_estimated}\x1b[0m\n`);
    }
  } catch {
    // Fallback: just print raw
    process.stdout.write(result + "\n");
  }
}

// ─── Help Text ──────────────────────────────────────────────────────────────

function printHelp(): void {
  process.stdout.write(`Novada Proxy v${VERSION} -- Residential proxy CLI for AI agents

Usage: novada-proxy <command> [options]

Commands:
  fetch <url>              Fetch URL through residential proxy
  batch <url1> <url2> ...  Fetch multiple URLs concurrently
  search <query>           Web search via Google
  extract <url>            Extract structured fields from URL
  map <url>                Discover all internal links on a page
  render <url>             Render JS-heavy page with Chromium
  session <id> <url>       Sticky session fetch (same IP)
  status                   Check proxy health

Options:
  --help, -h     Show help
  --version, -v  Show version
  --human        Pretty-print output for humans (default: JSON)

Environment:
  NOVADA_PROXY_USER   Proxy username (novada.com)
  NOVADA_PROXY_PASS   Proxy password
  NOVADA_API_KEY      Search API key
  NOVADA_BROWSER_WS   Browser API WebSocket URL

Install: npm install -g ${NPM_PACKAGE}
`);
}

function printSubcommandHelp(subcommand: string): void {
  const helpMap: Record<string, string> = {
    fetch: `Usage: novada-proxy fetch <url> [options]

Options:
  --country <CC>       2-letter country code (e.g. US, DE, JP)
  --city <name>        City-level targeting (e.g. newyork, london)
  --session_id <id>    Sticky session ID (letters, numbers, underscores)
  --format <fmt>       Output format: markdown (default) or raw
  --timeout <sec>      Timeout in seconds, 1-120 (default: 60)
  --human              Pretty-print output for humans`,

    batch: `Usage: novada-proxy batch <url1> <url2> ... [options]

Options:
  --country <CC>       2-letter country code for all requests
  --concurrency <n>    Max concurrent fetches, 1-5 (default: 3)
  --format <fmt>       Output format: markdown (default) or raw
  --timeout <sec>      Per-URL timeout in seconds, 1-120 (default: 60)
  --human              Pretty-print output for humans`,

    search: `Usage: novada-proxy search <query> [options]

Options:
  --num <n>            Number of results, 1-20 (default: 10)
  --country <CC>       Localized results (e.g. us, uk, de)
  --language <lang>    Language code (e.g. en, zh, de)
  --human              Pretty-print output for humans`,

    extract: `Usage: novada-proxy extract <url> --fields title,price,description [options]

Options:
  --fields <list>      Comma-separated field names to extract (required)
  --country <CC>       2-letter country code
  --city <name>        City-level targeting
  --session_id <id>    Sticky session ID
  --timeout <sec>      Timeout in seconds, 1-120 (default: 60)
  --render_fallback    Auto-retry via Chromium if proxy fails
  --human              Pretty-print output for humans`,

    map: `Usage: novada-proxy map <url> [options]

Options:
  --limit <n>          Max URLs to return, 10-200 (default: 50)
  --include_external   Include off-domain links
  --country <CC>       2-letter country code
  --timeout <sec>      Timeout in seconds, 1-120 (default: 60)
  --human              Pretty-print output for humans`,

    render: `Usage: novada-proxy render <url> [options]

Options:
  --format <fmt>       Output format: markdown (default), html, or text
  --wait_for <sel>     CSS selector to wait for before extracting
  --timeout <sec>      Timeout in seconds, 5-120 (default: 60)
  --human              Pretty-print output for humans`,

    session: `Usage: novada-proxy session <session_id> <url> [options]

Options:
  --country <CC>       2-letter country code
  --city <name>        City-level targeting
  --format <fmt>       Output format: markdown (default) or raw
  --timeout <sec>      Timeout in seconds, 1-120 (default: 60)
  --verify_sticky      Verify IP consistency with second httpbin call
  --human              Pretty-print output for humans`,

    status: `Usage: novada-proxy status [options]

Options:
  --human              Pretty-print output for humans`,
  };

  const help = helpMap[subcommand];
  if (help) {
    process.stdout.write(help + "\n");
  } else {
    printHelp();
  }
}

// ─── Subcommand Handlers ────────────────────────────────────────────────────

async function handleFetch(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      country:    { type: "string" },
      city:       { type: "string" },
      session_id: { type: "string" },
      format:     { type: "string" },
      timeout:    { type: "string" },
      human:      { type: "boolean", default: false },
      help:       { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.help) { printSubcommandHelp("fetch"); return; }

  const url = positionals[0];
  if (!url) invalidArgs("fetch", "Missing required argument: <url>");

  if (!proxyContext) missingProxyError();

  const params = validateFetchParams({
    url,
    country: values.country,
    city: values.city,
    session_id: values.session_id,
    format: values.format,
    timeout: values.timeout !== undefined ? Number(values.timeout) : undefined,
  });

  const result = await agentproxyFetch(params, proxyContext.adapter, proxyContext.credentials);

  if (values.human) { prettyPrint(result); } else { writeJson(JSON.parse(result)); }
}

async function handleBatch(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      country:     { type: "string" },
      concurrency: { type: "string" },
      format:      { type: "string" },
      timeout:     { type: "string" },
      human:       { type: "boolean", default: false },
      help:        { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.help) { printSubcommandHelp("batch"); return; }

  if (positionals.length < 2) invalidArgs("batch", "batch requires at least 2 URLs");

  if (!proxyContext) missingProxyError();

  const params = validateBatchFetchParams({
    urls: positionals,
    country: values.country,
    format: values.format,
    timeout: values.timeout !== undefined ? Number(values.timeout) : undefined,
    concurrency: values.concurrency !== undefined ? Number(values.concurrency) : undefined,
  });

  const result = await agentproxyBatchFetch(params, proxyContext.adapter, proxyContext.credentials);

  if (values.human) { prettyPrint(result); } else { writeJson(JSON.parse(result)); }
}

async function handleSearch(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      num:      { type: "string" },
      country:  { type: "string" },
      language: { type: "string" },
      human:    { type: "boolean", default: false },
      help:     { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.help) { printSubcommandHelp("search"); return; }

  const query = positionals.join(" ");
  if (!query) invalidArgs("search", "Missing required argument: <query>");

  if (!NOVADA_API_KEY) missingApiKeyError();

  const params = validateSearchParams({
    query,
    num: values.num !== undefined ? Number(values.num) : undefined,
    country: values.country,
    language: values.language,
  });

  const result = await agentproxySearch(params, NOVADA_API_KEY);

  if (values.human) { prettyPrint(result); } else { writeJson(JSON.parse(result)); }
}

async function handleExtract(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      fields:          { type: "string" },
      country:         { type: "string" },
      city:            { type: "string" },
      session_id:      { type: "string" },
      timeout:         { type: "string" },
      render_fallback: { type: "boolean", default: false },
      human:           { type: "boolean", default: false },
      help:            { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.help) { printSubcommandHelp("extract"); return; }

  const url = positionals[0];
  if (!url) invalidArgs("extract", "Missing required argument: <url>");
  if (!values.fields || typeof values.fields !== "string") invalidArgs("extract", "Missing required option: --fields title,price,description");

  if (!proxyContext) missingProxyError();

  const fields = (values.fields as string).split(",").map((f: string) => f.trim()).filter(Boolean);

  const params = validateExtractParams({
    url,
    fields,
    country: values.country,
    city: values.city,
    session_id: values.session_id,
    timeout: values.timeout !== undefined ? Number(values.timeout) : undefined,
    render_fallback: values.render_fallback,
  });

  const result = await agentproxyExtract(params, proxyContext.adapter, proxyContext.credentials, NOVADA_BROWSER_WS);

  if (values.human) { prettyPrint(result); } else { writeJson(JSON.parse(result)); }
}

async function handleMap(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      limit:            { type: "string" },
      include_external: { type: "boolean", default: false },
      country:          { type: "string" },
      timeout:          { type: "string" },
      human:            { type: "boolean", default: false },
      help:             { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.help) { printSubcommandHelp("map"); return; }

  const url = positionals[0];
  if (!url) invalidArgs("map", "Missing required argument: <url>");

  if (!proxyContext) missingProxyError();

  const params = validateMapParams({
    url,
    limit: values.limit !== undefined ? Number(values.limit) : undefined,
    include_external: values.include_external,
    country: values.country,
    timeout: values.timeout !== undefined ? Number(values.timeout) : undefined,
  });

  const result = await agentproxyMap(params, proxyContext.adapter, proxyContext.credentials);

  if (values.human) { prettyPrint(result); } else { writeJson(JSON.parse(result)); }
}

async function handleRender(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      format:   { type: "string" },
      wait_for: { type: "string" },
      timeout:  { type: "string" },
      human:    { type: "boolean", default: false },
      help:     { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.help) { printSubcommandHelp("render"); return; }

  const url = positionals[0];
  if (!url) invalidArgs("render", "Missing required argument: <url>");

  if (!NOVADA_BROWSER_WS) missingBrowserWsError();

  const params = validateRenderParams({
    url,
    format: values.format,
    wait_for: values.wait_for,
    timeout: values.timeout !== undefined ? Number(values.timeout) : undefined,
  });

  const result = await agentproxyRender(params, NOVADA_BROWSER_WS);

  if (values.human) { prettyPrint(result); } else { writeJson(JSON.parse(result)); }
}

async function handleSession(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      country:       { type: "string" },
      city:          { type: "string" },
      format:        { type: "string" },
      timeout:       { type: "string" },
      verify_sticky: { type: "boolean", default: false },
      human:         { type: "boolean", default: false },
      help:          { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.help) { printSubcommandHelp("session"); return; }

  const sessionId = positionals[0];
  const url = positionals[1];
  if (!sessionId) invalidArgs("session", "Missing required argument: <session_id>");
  if (!url) invalidArgs("session", "Missing required argument: <url>");

  if (!proxyContext) missingProxyError();

  const params = validateSessionParams({
    session_id: sessionId,
    url,
    country: values.country,
    city: values.city,
    format: values.format,
    timeout: values.timeout !== undefined ? Number(values.timeout) : undefined,
    verify_sticky: values.verify_sticky,
  });

  const result = await agentproxySession(params, proxyContext.adapter, proxyContext.credentials);

  if (values.human) { prettyPrint(result); } else { writeJson(JSON.parse(result)); }
}

async function handleStatus(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      human: { type: "boolean", default: false },
      help:  { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.help) { printSubcommandHelp("status"); return; }

  const result = await agentproxyStatus(proxyContext?.adapter, proxyContext?.credentials);

  if (values.human) { prettyPrint(result); } else { writeJson(JSON.parse(result)); }
}

// ─── Main Router ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const subcommand = process.argv[2];
  const restArgs = process.argv.slice(3);

  try {
    switch (subcommand) {
      case "fetch":   await handleFetch(restArgs);   break;
      case "batch":   await handleBatch(restArgs);   break;
      case "search":  await handleSearch(restArgs);   break;
      case "extract": await handleExtract(restArgs);  break;
      case "map":     await handleMap(restArgs);      break;
      case "render":  await handleRender(restArgs);   break;
      case "session": await handleSession(restArgs);  break;
      case "status":  await handleStatus(restArgs);   break;
      case "--help":  case "-h":  printHelp(); break;
      case "--version": case "-v": process.stdout.write(VERSION + "\n"); break;
      default:
        if (!subcommand) {
          printHelp();
          process.exit(1);
        }
        process.stderr.write(JSON.stringify({
          ok: false,
          error: {
            code: "INVALID_INPUT",
            message: `Unknown command: ${subcommand}`,
            recoverable: false,
            agent_instruction: "Run: novada-proxy --help for available commands.",
          },
        } satisfies ProxyErrorResponse, null, 2) + "\n");
        process.exit(1);
    }
  } catch (err) {
    handleToolError(err);
  }
}

main();
