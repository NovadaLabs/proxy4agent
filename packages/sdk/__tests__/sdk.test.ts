import { beforeEach, describe, expect, it, vi } from "vitest";
import { NovadaProxy } from "../src/index.js";

const {
  fakeAdapter,
  fakeCredentials,
  resolveAdapter,
  novadaProxyFetch,
  validateFetchParams,
  novadaProxyBatchFetch,
  validateBatchFetchParams,
  novadaProxySearch,
  validateSearchParams,
  novadaProxyExtract,
  validateExtractParams,
  novadaProxyMap,
  validateMapParams,
  novadaProxyCrawl,
  validateCrawlParams,
  novadaProxyResearch,
  validateResearchParams,
  novadaProxyRender,
  validateRenderParams,
  novadaProxySession,
  validateSessionParams,
  novadaProxyStatus,
} = vi.hoisted(() => {
  const result = (tool: string) => JSON.stringify({ ok: true, tool, data: { parsed: true }, meta: { latency_ms: 1 } });
  const validator = vi.fn((params: Record<string, unknown>) => params);

  return {
    fakeAdapter: {
      name: "fake",
      displayName: "Fake",
      lastVerified: "2026-05-04",
      capabilities: { country: true, city: true, sticky: true },
      credentialDocs: "fake docs",
      sensitiveFields: ["pass"],
      loadCredentials: vi.fn(),
      buildProxyUrl: vi.fn(),
    },
    fakeCredentials: { user: "user", pass: "pass", host: "host", port: "7777" },
    resolveAdapter: vi.fn(),
    novadaProxyFetch: vi.fn(() => Promise.resolve(result("novada_proxy_fetch"))),
    validateFetchParams: validator,
    novadaProxyBatchFetch: vi.fn(() => Promise.resolve(result("novada_proxy_batch_fetch"))),
    validateBatchFetchParams: vi.fn((params: Record<string, unknown>) => params),
    novadaProxySearch: vi.fn(() => Promise.resolve(result("novada_proxy_search"))),
    validateSearchParams: vi.fn((params: Record<string, unknown>) => params),
    novadaProxyExtract: vi.fn(() => Promise.resolve(result("novada_proxy_extract"))),
    validateExtractParams: vi.fn((params: Record<string, unknown>) => params),
    novadaProxyMap: vi.fn(() => Promise.resolve(result("novada_proxy_map"))),
    validateMapParams: vi.fn((params: Record<string, unknown>) => params),
    novadaProxyCrawl: vi.fn(() => Promise.resolve(result("novada_proxy_crawl"))),
    validateCrawlParams: vi.fn((params: Record<string, unknown>) => params),
    novadaProxyResearch: vi.fn(() => Promise.resolve(result("novada_proxy_research"))),
    validateResearchParams: vi.fn((params: Record<string, unknown>) => params),
    novadaProxyRender: vi.fn(() => Promise.resolve(result("novada_proxy_render"))),
    validateRenderParams: vi.fn((params: Record<string, unknown>) => params),
    novadaProxySession: vi.fn(() => Promise.resolve(result("novada_proxy_session"))),
    validateSessionParams: vi.fn((params: Record<string, unknown>) => params),
    novadaProxyStatus: vi.fn(() => Promise.resolve(result("novada_proxy_status"))),
  };
});

vi.mock("@novada/proxy-core", () => ({
  resolveAdapter,
  novadaProxyFetch,
  validateFetchParams,
  novadaProxyBatchFetch,
  validateBatchFetchParams,
  novadaProxySearch,
  validateSearchParams,
  novadaProxyExtract,
  validateExtractParams,
  novadaProxyMap,
  validateMapParams,
  novadaProxyCrawl,
  validateCrawlParams,
  novadaProxyResearch,
  validateResearchParams,
  novadaProxyRender,
  validateRenderParams,
  novadaProxySession,
  validateSessionParams,
  novadaProxyStatus,
}));

const ENV_KEYS = [
  "NOVADA_PROXY_USER",
  "NOVADA_PROXY_PASS",
  "NOVADA_PROXY_HOST",
  "NOVADA_PROXY_PORT",
  "NOVADA_API_KEY",
  "NOVADA_BROWSER_WS",
  "NOVADA_PROXY_PROVIDER",
];

function resetEnv(): void {
  for (const key of ENV_KEYS) delete process.env[key];
}

function createClient(): NovadaProxy {
  return new NovadaProxy({
    user: "sdk-user",
    pass: "sdk-pass",
    host: "sdk-host",
    port: 7777,
    apiKey: "api-key",
    browserWs: "wss://browser",
  });
}

describe("NovadaProxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEnv();
    resolveAdapter.mockReturnValue({ adapter: fakeAdapter, credentials: fakeCredentials });
  });

  it("resolves adapter from constructor options", () => {
    createClient();

    expect(process.env.NOVADA_PROXY_USER).toBe("sdk-user");
    expect(process.env.NOVADA_PROXY_PASS).toBe("sdk-pass");
    expect(process.env.NOVADA_PROXY_HOST).toBe("sdk-host");
    expect(process.env.NOVADA_PROXY_PORT).toBe("7777");
    expect(resolveAdapter).toHaveBeenCalledWith(process.env);
  });

  it("stores apiKey and browserWs from options", async () => {
    const client = createClient();

    await client.search({ query: "novada" });
    await client.render({ url: "https://example.com" });

    expect(novadaProxySearch).toHaveBeenCalledWith(expect.any(Object), "api-key");
    expect(novadaProxyRender).toHaveBeenCalledWith(expect.any(Object), "wss://browser");
  });

  it("fromEnv() reads existing env vars", () => {
    process.env.NOVADA_PROXY_USER = "env-user";
    process.env.NOVADA_PROXY_PASS = "env-pass";

    NovadaProxy.fromEnv();

    expect(resolveAdapter).toHaveBeenCalledWith(process.env);
    expect(process.env.NOVADA_PROXY_USER).toBe("env-user");
  });

  it("throws when no adapter resolves", () => {
    resolveAdapter.mockReturnValueOnce(null);

    expect(() => new NovadaProxy({})).toThrow("No proxy adapter resolved");
  });

  it("fetch validates, calls core, and returns parsed JSON", async () => {
    const client = createClient();
    const result = await client.fetch({ url: "https://example.com", country: "US" });

    expect(validateFetchParams).toHaveBeenCalledWith({ url: "https://example.com", country: "US" });
    expect(novadaProxyFetch).toHaveBeenCalledWith(expect.any(Object), fakeAdapter, fakeCredentials);
    expect(result).toMatchObject({ ok: true, tool: "novada_proxy_fetch", data: { parsed: true } });
  });

  it("fetch translates sessionId to session_id", async () => {
    await createClient().fetch({ url: "https://example.com", sessionId: "abc_123" });

    expect(validateFetchParams).toHaveBeenCalledWith({ url: "https://example.com", session_id: "abc_123" });
  });

  it("batchFetch validates, calls core, and returns parsed JSON", async () => {
    const result = await createClient().batchFetch({ urls: ["https://a.com", "https://b.com"], concurrency: 2 });

    expect(validateBatchFetchParams).toHaveBeenCalledWith({ urls: ["https://a.com", "https://b.com"], concurrency: 2 });
    expect(novadaProxyBatchFetch).toHaveBeenCalledWith(expect.any(Object), fakeAdapter, fakeCredentials);
    expect(result.tool).toBe("novada_proxy_batch_fetch");
  });

  it("batchFetch translates sessionId to session_id", async () => {
    await createClient().batchFetch({ urls: ["https://a.com", "https://b.com"], sessionId: "sticky" });

    expect(validateBatchFetchParams).toHaveBeenCalledWith({ urls: ["https://a.com", "https://b.com"], session_id: "sticky" });
  });

  it("search validates, calls core with api key, and returns parsed JSON", async () => {
    const result = await createClient().search({ query: "residential proxies", num: 3 });

    expect(validateSearchParams).toHaveBeenCalledWith({ query: "residential proxies", num: 3 });
    expect(novadaProxySearch).toHaveBeenCalledWith(expect.any(Object), "api-key");
    expect(result.tool).toBe("novada_proxy_search");
  });

  it("search throws without api key", async () => {
    const client = new NovadaProxy({ user: "u", pass: "p" });

    await expect(client.search({ query: "x" })).rejects.toThrow("NOVADA_API_KEY is required");
  });

  it("extract validates, calls core, and returns parsed JSON", async () => {
    const result = await createClient().extract({ url: "https://example.com", fields: ["title"] });

    expect(validateExtractParams).toHaveBeenCalledWith({ url: "https://example.com", fields: ["title"] });
    expect(novadaProxyExtract).toHaveBeenCalledWith(expect.any(Object), fakeAdapter, fakeCredentials, "wss://browser");
    expect(result.tool).toBe("novada_proxy_extract");
  });

  it("extract translates sessionId and renderFallback", async () => {
    await createClient().extract({
      url: "https://example.com",
      fields: ["title"],
      sessionId: "s1",
      renderFallback: true,
    });

    expect(validateExtractParams).toHaveBeenCalledWith({
      url: "https://example.com",
      fields: ["title"],
      session_id: "s1",
      render_fallback: true,
    });
  });

  it("map validates, calls core, and returns parsed JSON", async () => {
    const result = await createClient().map({ url: "https://example.com", limit: 20 });

    expect(validateMapParams).toHaveBeenCalledWith({ url: "https://example.com", limit: 20 });
    expect(novadaProxyMap).toHaveBeenCalledWith(expect.any(Object), fakeAdapter, fakeCredentials);
    expect(result.tool).toBe("novada_proxy_map");
  });

  it("map translates includeExternal to include_external", async () => {
    await createClient().map({ url: "https://example.com", includeExternal: true });

    expect(validateMapParams).toHaveBeenCalledWith({ url: "https://example.com", include_external: true });
  });

  it("crawl validates, calls core, and returns parsed JSON", async () => {
    const result = await createClient().crawl({ url: "https://example.com", depth: 2 });

    expect(validateCrawlParams).toHaveBeenCalledWith({ url: "https://example.com", depth: 2 });
    expect(novadaProxyCrawl).toHaveBeenCalledWith(expect.any(Object), fakeAdapter, fakeCredentials);
    expect(result.tool).toBe("novada_proxy_crawl");
  });

  it("crawl translates includeContent to include_content", async () => {
    await createClient().crawl({ url: "https://example.com", includeContent: true });

    expect(validateCrawlParams).toHaveBeenCalledWith({ url: "https://example.com", include_content: true });
  });

  it("research validates, calls core with proxy credentials and api key, and returns parsed JSON", async () => {
    const result = await createClient().research({ query: "novada sdk", depth: "quick" });

    expect(validateResearchParams).toHaveBeenCalledWith({ query: "novada sdk", depth: "quick" });
    expect(novadaProxyResearch).toHaveBeenCalledWith(expect.any(Object), fakeAdapter, fakeCredentials, "api-key");
    expect(result.tool).toBe("novada_proxy_research");
  });

  it("research throws without api key", async () => {
    const client = new NovadaProxy({ user: "u", pass: "p" });

    await expect(client.research({ query: "x" })).rejects.toThrow("NOVADA_API_KEY is required");
  });

  it("render validates, calls core with browser ws, and returns parsed JSON", async () => {
    const result = await createClient().render({ url: "https://example.com", format: "html" });

    expect(validateRenderParams).toHaveBeenCalledWith({ url: "https://example.com", format: "html" });
    expect(novadaProxyRender).toHaveBeenCalledWith(expect.any(Object), "wss://browser");
    expect(result.tool).toBe("novada_proxy_render");
  });

  it("render translates waitFor to wait_for", async () => {
    await createClient().render({ url: "https://example.com", waitFor: "#app" });

    expect(validateRenderParams).toHaveBeenCalledWith({ url: "https://example.com", wait_for: "#app" });
  });

  it("render throws without browser ws", async () => {
    const client = new NovadaProxy({ user: "u", pass: "p" });

    await expect(client.render({ url: "https://example.com" })).rejects.toThrow("NOVADA_BROWSER_WS is required");
  });

  it("session validates, calls core, and returns parsed JSON", async () => {
    const result = await createClient().session({ url: "https://example.com", sessionId: "s1" });

    expect(validateSessionParams).toHaveBeenCalledWith({ url: "https://example.com", session_id: "s1" });
    expect(novadaProxySession).toHaveBeenCalledWith(expect.any(Object), fakeAdapter, fakeCredentials);
    expect(result.tool).toBe("novada_proxy_session");
  });

  it("session translates verifySticky to verify_sticky", async () => {
    await createClient().session({ url: "https://example.com", sessionId: "s1", verifySticky: true });

    expect(validateSessionParams).toHaveBeenCalledWith({
      url: "https://example.com",
      session_id: "s1",
      verify_sticky: true,
    });
  });

  it("status calls core with resolved adapter credentials and returns parsed JSON", async () => {
    const result = await createClient().status();

    expect(novadaProxyStatus).toHaveBeenCalledWith(fakeAdapter, fakeCredentials);
    expect(result.tool).toBe("novada_proxy_status");
    expect(typeof result).toBe("object");
  });
});
