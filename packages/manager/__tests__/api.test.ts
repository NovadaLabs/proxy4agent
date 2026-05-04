import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";

const core = vi.hoisted(() => ({
  resolveAdapter: vi.fn(),
  novadaProxyFetch: vi.fn(),
  validateFetchParams: vi.fn(),
  novadaProxyStatus: vi.fn(),
}));

vi.mock("@novada/proxy-core", () => core);

const { handleApiRequest, resetManagerStateForTests } = await import("../src/api.js");

function validateFetchParams(raw: Record<string, unknown>) {
  if (!raw.url || typeof raw.url !== "string") throw new Error("url is required and must be a string");
  if (!raw.url.startsWith("http://") && !raw.url.startsWith("https://")) {
    throw new Error("url must start with http:// or https://");
  }
  return {
    url: raw.url,
    country: raw.country as string | undefined,
    format: (raw.format as string | undefined) || "markdown",
    timeout: Number(raw.timeout || 60),
  };
}

describe("manager API", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    resetManagerStateForTests();
    core.resolveAdapter.mockReturnValue({
      adapter: { displayName: "Novada" },
      credentials: { user: "user", pass: "pass" },
    });
    core.validateFetchParams.mockImplementation(validateFetchParams);
    core.novadaProxyStatus.mockResolvedValue(JSON.stringify({
      ok: true,
      data: {
        provider: "Novada",
        connectivity: { status: "HEALTHY", proxy_ip: "203.0.113.10" },
      },
    }));
    core.novadaProxyFetch.mockResolvedValue(JSON.stringify({
      ok: true,
      data: { content: "example content", status_code: 200 },
      meta: { latency_ms: 42, proxy_ip: "203.0.113.20" },
    }));

    server = createServer(async (req, res) => {
      if (await handleApiRequest(req, res)) return;
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server did not bind to a port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    server.closeIdleConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    vi.clearAllMocks();
  });

  async function api(path: string, init?: RequestInit) {
    const response = await fetch(`${baseUrl}${path}`, init);
    return {
      response,
      body: await response.json() as Record<string, unknown>,
    };
  }

  it("GET /api/status returns valid JSON with provider field", async () => {
    const { response, body } = await api("/api/status");
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.provider).toBe("Novada");
    expect(body.connected).toBe(true);
    expect(body.proxy_ip).toBe("203.0.113.10");
    expect(typeof body.uptime_ms).toBe("number");
  });

  it("GET /api/status reports disconnected without runtime credentials", async () => {
    core.resolveAdapter.mockReturnValueOnce(null);
    const { body } = await api("/api/status");
    expect(body.connected).toBe(false);
    expect(body.provider).toBe("novada");
  });

  it("GET /api/config returns credentials_set status", async () => {
    const { response, body } = await api("/api/config");
    expect(response.status).toBe(200);
    expect(body.provider).toBe("novada");
    expect(body.credentials_set).toBe(true);
    expect(body.api_key_set).toBe(false);
    expect(body.browser_ws_set).toBe(false);
  });

  it("POST /api/config stores config", async () => {
    await api("/api/config", {
      method: "POST",
      body: JSON.stringify({ provider: "brightdata", user: "u", pass: "p", api_key: "k", browser_ws: "ws://x" }),
    });

    const { body } = await api("/api/config");
    expect(body.provider).toBe("brightdata");
    expect(body.credentials_set).toBe(true);
    expect(body.api_key_set).toBe(true);
    expect(body.browser_ws_set).toBe(true);
  });

  it("POST /api/config accepts numeric port values", async () => {
    const { response, body } = await api("/api/config", {
      method: "POST",
      body: JSON.stringify({ provider: "novada", user: "u", pass: "p", port: 7777 }),
    });
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("GET /api/logs returns empty array initially", async () => {
    const { response, body } = await api("/api/logs");
    expect(response.status).toBe(200);
    expect(body.logs).toEqual([]);
  });

  it("POST /api/test with missing URL returns 400", async () => {
    const { response, body } = await api("/api/test", {
      method: "POST",
      body: JSON.stringify({ country: "US" }),
    });
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("POST /api/test validates URL schemes", async () => {
    const { response, body } = await api("/api/test", {
      method: "POST",
      body: JSON.stringify({ url: "ftp://example.com" }),
    });
    expect(response.status).toBe(400);
    expect(body.error).toContain("http:// or https://");
  });

  it("POST /api/test returns proxy data and appends a log entry", async () => {
    const { response, body } = await api("/api/test", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com", country: "DE" }),
    });
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({ content: "example content", status_code: 200 });

    const logs = await api("/api/logs");
    expect(logs.body.logs).toMatchObject([
      { method: "GET", url: "https://example.com", status: 200, country: "DE", proxy_ip: "203.0.113.20" },
    ]);
  });

  it("POST /api/test returns 400 when credentials are not configured", async () => {
    core.resolveAdapter.mockReturnValue(null);
    const { response, body } = await api("/api/test", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com" }),
    });
    expect(response.status).toBe(400);
    expect(body.error).toBe("proxy credentials are not configured");
  });

  it("POST /api/test returns 502 and logs failed proxy requests", async () => {
    core.novadaProxyFetch.mockRejectedValueOnce(new Error("upstream failed"));
    const { response, body } = await api("/api/test", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com" }),
    });
    expect(response.status).toBe(502);
    expect(body.error).toBe("upstream failed");

    const logs = await api("/api/logs");
    expect((logs.body.logs as unknown[])[0]).toMatchObject({ status: 502, url: "https://example.com" });
  });

  it("Unknown API route returns 404", async () => {
    const { response, body } = await api("/api/unknown");
    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
  });

  it("rejects invalid JSON bodies", async () => {
    const { response, body } = await api("/api/config", {
      method: "POST",
      body: "{nope",
    });
    expect(response.status).toBe(500);
    expect(body.error).toBe("invalid JSON body");
  });
});
