import {
  novadaProxyBatchFetch,
  novadaProxyCrawl,
  novadaProxyExtract,
  novadaProxyFetch,
  novadaProxyMap,
  novadaProxyRender,
  novadaProxyResearch,
  novadaProxySearch,
  novadaProxySession,
  novadaProxyStatus,
  resolveAdapter,
  validateBatchFetchParams,
  validateCrawlParams,
  validateExtractParams,
  validateFetchParams,
  validateMapParams,
  validateRenderParams,
  validateResearchParams,
  validateSearchParams,
  validateSessionParams,
  type ProxyAdapter,
  type ProxyCredentials,
  type ProxySuccessResponse,
} from "@novada/proxy-core";

import type {
  BatchFetchOptions,
  CrawlOptions,
  ExtractOptions,
  FetchOptions,
  MapOptions,
  NovadaProxyOptions,
  RenderOptions,
  ResearchOptions,
  SearchOptions,
  SessionOptions,
} from "./types.js";

export type {
  BatchFetchOptions,
  CrawlOptions,
  ExtractOptions,
  FetchOptions,
  MapOptions,
  NovadaProxyOptions,
  RenderOptions,
  ResearchOptions,
  SearchOptions,
  SessionOptions,
} from "./types.js";

export type {
  ProxyAdapter,
  ProxyCredentials,
  ProxyErrorResponse,
  ProxyResponse,
  ProxySuccessResponse,
} from "@novada/proxy-core";

type JsonObject = Record<string, unknown>;

function parseResult(raw: string): ProxySuccessResponse {
  return JSON.parse(raw) as ProxySuccessResponse;
}

function dropUndefined<T extends JsonObject>(value: T): T {
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) delete value[key];
  }
  return value;
}

function configureEnv(options: NovadaProxyOptions): void {
  if (options.user !== undefined) process.env.NOVADA_PROXY_USER = options.user;
  if (options.pass !== undefined) process.env.NOVADA_PROXY_PASS = options.pass;
  if (options.host !== undefined) process.env.NOVADA_PROXY_HOST = options.host;
  if (options.port !== undefined) process.env.NOVADA_PROXY_PORT = String(options.port);
  if (options.apiKey !== undefined) process.env.NOVADA_API_KEY = options.apiKey;
  if (options.browserWs !== undefined) process.env.NOVADA_BROWSER_WS = options.browserWs;
  if (options.provider !== undefined) process.env.NOVADA_PROXY_PROVIDER = options.provider;
}

export class NovadaProxy {
  private readonly adapter: ProxyAdapter;
  private readonly credentials: ProxyCredentials;
  private readonly apiKey?: string;
  private readonly browserWs?: string;

  constructor(options: NovadaProxyOptions = {}) {
    configureEnv(options);

    const resolved = resolveAdapter(process.env);
    if (!resolved) {
      throw new Error("No proxy adapter resolved. Provide Novada proxy credentials or set NOVADA_PROXY_USER and NOVADA_PROXY_PASS.");
    }

    this.adapter = resolved.adapter;
    this.credentials = resolved.credentials;
    this.apiKey = options.apiKey ?? process.env.NOVADA_API_KEY;
    this.browserWs = options.browserWs ?? process.env.NOVADA_BROWSER_WS;
  }

  static fromEnv(): NovadaProxy {
    return new NovadaProxy({});
  }

  async fetch(options: FetchOptions): Promise<ProxySuccessResponse> {
    const params = validateFetchParams(dropUndefined({
      url: options.url,
      country: options.country,
      city: options.city,
      session_id: options.sessionId,
      format: options.format,
      timeout: options.timeout,
    }));
    return parseResult(await novadaProxyFetch(params, this.adapter, this.credentials));
  }

  async batchFetch(options: BatchFetchOptions): Promise<ProxySuccessResponse> {
    const params = validateBatchFetchParams(dropUndefined({
      urls: options.urls,
      country: options.country,
      session_id: options.sessionId,
      format: options.format,
      timeout: options.timeout,
      concurrency: options.concurrency,
    }));
    return parseResult(await novadaProxyBatchFetch(params, this.adapter, this.credentials));
  }

  async search(options: SearchOptions): Promise<ProxySuccessResponse> {
    if (!this.apiKey) {
      throw new Error("NOVADA_API_KEY is required for search.");
    }
    const params = validateSearchParams(dropUndefined({
      query: options.query,
      engine: options.engine,
      num: options.num,
      country: options.country,
      language: options.language,
    }));
    return parseResult(await novadaProxySearch(params, this.apiKey));
  }

  async extract(options: ExtractOptions): Promise<ProxySuccessResponse> {
    const params = validateExtractParams(dropUndefined({
      url: options.url,
      fields: options.fields,
      schema: options.schema,
      country: options.country,
      city: options.city,
      session_id: options.sessionId,
      timeout: options.timeout,
      render_fallback: options.renderFallback,
    }));
    return parseResult(await novadaProxyExtract(params, this.adapter, this.credentials, this.browserWs));
  }

  async map(options: MapOptions): Promise<ProxySuccessResponse> {
    const params = validateMapParams(dropUndefined({
      url: options.url,
      limit: options.limit,
      include_external: options.includeExternal,
      country: options.country,
      timeout: options.timeout,
    }));
    return parseResult(await novadaProxyMap(params, this.adapter, this.credentials));
  }

  async crawl(options: CrawlOptions): Promise<ProxySuccessResponse> {
    const params = validateCrawlParams(dropUndefined({
      url: options.url,
      depth: options.depth,
      limit: options.limit,
      include_content: options.includeContent,
      country: options.country,
      timeout: options.timeout,
      format: options.format,
    }));
    return parseResult(await novadaProxyCrawl(params, this.adapter, this.credentials));
  }

  async research(options: ResearchOptions): Promise<ProxySuccessResponse> {
    if (!this.apiKey) {
      throw new Error("NOVADA_API_KEY is required for research.");
    }
    const params = validateResearchParams(dropUndefined({
      query: options.query,
      depth: options.depth,
      country: options.country,
      timeout: options.timeout,
    }));
    return parseResult(await novadaProxyResearch(params, this.adapter, this.credentials, this.apiKey));
  }

  async render(options: RenderOptions): Promise<ProxySuccessResponse> {
    if (!this.browserWs) {
      throw new Error("NOVADA_BROWSER_WS is required for render.");
    }
    const params = validateRenderParams(dropUndefined({
      url: options.url,
      format: options.format,
      wait_for: options.waitFor,
      timeout: options.timeout,
    }));
    return parseResult(await novadaProxyRender(params, this.browserWs));
  }

  async session(options: SessionOptions): Promise<ProxySuccessResponse> {
    const params = validateSessionParams(dropUndefined({
      session_id: options.sessionId,
      url: options.url,
      country: options.country,
      city: options.city,
      format: options.format,
      timeout: options.timeout,
      verify_sticky: options.verifySticky,
    }));
    return parseResult(await novadaProxySession(params, this.adapter, this.credentials));
  }

  async status(): Promise<ProxySuccessResponse> {
    return parseResult(await novadaProxyStatus(this.adapter, this.credentials));
  }
}
