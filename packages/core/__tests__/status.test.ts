import { vi, describe, it, expect, beforeEach } from "vitest";
import { novadaProxyStatus } from "../src/tools/status.js";
import { VERSION } from "../src/config.js";
import type { ProxyAdapter, ProxyCredentials } from "../src/adapters/index.js";
import type { ProxySuccessResponse } from "../src/types.js";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { axiosGetSpy } = vi.hoisted(() => ({
  axiosGetSpy: vi.fn(),
}));

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: {
      get: axiosGetSpy,
    },
  };
});

vi.mock("https-proxy-agent", () => ({
  HttpsProxyAgent: class { constructor() {} },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockAdapter: ProxyAdapter = {
  name: "test",
  displayName: "Test",
  lastVerified: "2026-01-01",
  capabilities: { country: true, city: true, sticky: true },
  credentialDocs: "test",
  sensitiveFields: ["pass"] as readonly string[],
  loadCredentials: () => ({ user: "u", pass: "p", host: "h", port: "7777" }),
  buildProxyUrl: () => "http://u:p@h:7777",
};

const mockCreds: ProxyCredentials = { user: "u", pass: "p", host: "h", port: "7777" };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("novadaProxyStatus", () => {
  beforeEach(() => {
    axiosGetSpy.mockReset();
  });

  it("returns HEALTHY when proxy returns 200 with origin IP", async () => {
    axiosGetSpy.mockResolvedValueOnce({
      data: { origin: "1.2.3.4" },
    });

    const raw = await novadaProxyStatus(mockAdapter, mockCreds);
    const result = JSON.parse(raw) as ProxySuccessResponse;

    expect(result.ok).toBe(true);
    expect(result.tool).toBe("novada_proxy_status");
    expect(result.data.connectivity).toMatchObject({
      status: "HEALTHY",
      verified_via: "https://httpbin.org/ip",
      proxy_ip: "1.2.3.4",
    });
  });

  it("includes adapter displayName and VERSION", async () => {
    axiosGetSpy.mockResolvedValueOnce({
      data: { origin: "5.6.7.8" },
    });

    const raw = await novadaProxyStatus(mockAdapter, mockCreds);
    const result = JSON.parse(raw) as ProxySuccessResponse;

    expect(result.data.provider).toBe("Test");
    expect(result.data.version).toBe(VERSION);
  });

  it("returns DEGRADED when response has no origin field", async () => {
    axiosGetSpy.mockResolvedValueOnce({
      data: {},
    });

    const raw = await novadaProxyStatus(mockAdapter, mockCreds);
    const result = JSON.parse(raw) as ProxySuccessResponse;

    expect((result.data.connectivity as Record<string, unknown>).status).toBe("DEGRADED");
    expect((result.data.connectivity as Record<string, unknown>).proxy_ip).toBeUndefined();
  });

  it("returns UNAVAILABLE on network error", async () => {
    axiosGetSpy.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const raw = await novadaProxyStatus(mockAdapter, mockCreds);
    const result = JSON.parse(raw) as ProxySuccessResponse;

    expect((result.data.connectivity as Record<string, unknown>).status).toBe("UNAVAILABLE");
    expect((result.data.connectivity as Record<string, unknown>).proxy_ip).toBeUndefined();
  });

  it("returns UNAVAILABLE on timeout", async () => {
    axiosGetSpy.mockRejectedValueOnce(new Error("timeout of 10000ms exceeded"));

    const raw = await novadaProxyStatus(mockAdapter, mockCreds);
    const result = JSON.parse(raw) as ProxySuccessResponse;

    expect((result.data.connectivity as Record<string, unknown>).status).toBe("UNAVAILABLE");
  });

  it("returns response format { ok, tool, data, meta }", async () => {
    axiosGetSpy.mockResolvedValueOnce({
      data: { origin: "9.9.9.9" },
    });

    const raw = await novadaProxyStatus(mockAdapter, mockCreds);
    const result = JSON.parse(raw);

    expect(result).toHaveProperty("ok", true);
    expect(result).toHaveProperty("tool", "novada_proxy_status");
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("meta");
    expect(result.meta).toHaveProperty("latency_ms");
    expect(result.meta).toHaveProperty("quota");
    expect(result.meta.quota.credits_estimated).toBe(1);
  });

  it("includes capabilities from adapter", async () => {
    axiosGetSpy.mockResolvedValueOnce({
      data: { origin: "1.1.1.1" },
    });

    const raw = await novadaProxyStatus(mockAdapter, mockCreds);
    const result = JSON.parse(raw) as ProxySuccessResponse;

    expect(result.data.capabilities).toContain("country_targeting");
    expect(result.data.capabilities).toContain("city_targeting");
    expect(result.data.capabilities).toContain("sticky_sessions");
  });

  it("returns UNAVAILABLE with 'none configured' when no adapter provided", async () => {
    const raw = await novadaProxyStatus(undefined, undefined);
    const result = JSON.parse(raw) as ProxySuccessResponse;

    expect(result.data.provider).toBe("none configured");
    expect((result.data.connectivity as Record<string, unknown>).status).toBe("UNAVAILABLE");
    expect(result.data.capabilities).toEqual([]);
    // axios should not be called at all
    expect(axiosGetSpy).not.toHaveBeenCalled();
  });

  it("latency_ms is a non-negative number", async () => {
    axiosGetSpy.mockResolvedValueOnce({
      data: { origin: "1.1.1.1" },
    });

    const raw = await novadaProxyStatus(mockAdapter, mockCreds);
    const result = JSON.parse(raw) as ProxySuccessResponse;

    expect(typeof result.meta.latency_ms).toBe("number");
    expect(result.meta.latency_ms).toBeGreaterThanOrEqual(0);
    // data.connectivity.latency_ms should match meta.latency_ms
    expect((result.data.connectivity as Record<string, unknown>).latency_ms).toBe(result.meta.latency_ms);
  });

  it("handles comma-separated origin (multi-IP) by using the first IP", async () => {
    axiosGetSpy.mockResolvedValueOnce({
      data: { origin: "10.0.0.1, 10.0.0.2" },
    });

    const raw = await novadaProxyStatus(mockAdapter, mockCreds);
    const result = JSON.parse(raw) as ProxySuccessResponse;

    expect((result.data.connectivity as Record<string, unknown>).status).toBe("HEALTHY");
    expect((result.data.connectivity as Record<string, unknown>).proxy_ip).toBe("10.0.0.1");
  });

  it("reports limited capabilities when adapter lacks some", async () => {
    const limitedAdapter: ProxyAdapter = {
      ...mockAdapter,
      capabilities: { country: true, city: false, sticky: false },
    };

    axiosGetSpy.mockResolvedValueOnce({
      data: { origin: "1.1.1.1" },
    });

    const raw = await novadaProxyStatus(limitedAdapter, mockCreds);
    const result = JSON.parse(raw) as ProxySuccessResponse;

    expect(result.data.capabilities).toContain("country_targeting");
    expect(result.data.capabilities).not.toContain("city_targeting");
    expect(result.data.capabilities).not.toContain("sticky_sessions");
  });
});
