import { vi, describe, it, expect, beforeEach } from "vitest";
import { novadaProxySession, validateSessionParams } from "../tools/session.js";
// ─── Mocks ────────────────────────────────────────────────────────────────────
const { novadaProxyFetchSpy } = vi.hoisted(() => ({
    novadaProxyFetchSpy: vi.fn(),
}));
vi.mock("../tools/fetch.js", () => ({
    novadaProxyFetch: novadaProxyFetchSpy,
}));
const { axiosGetSpy } = vi.hoisted(() => ({
    axiosGetSpy: vi.fn(),
}));
vi.mock("axios", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        default: {
            get: axiosGetSpy,
        },
    };
});
vi.mock("https-proxy-agent", () => ({
    HttpsProxyAgent: class {
        constructor() { }
    },
}));
// ─── Fixtures ─────────────────────────────────────────────────────────────────
const mockAdapter = {
    name: "test",
    displayName: "Test",
    lastVerified: "2026-01-01",
    capabilities: { country: true, city: true, sticky: true },
    credentialDocs: "test",
    sensitiveFields: ["pass"],
    loadCredentials: () => ({ user: "u", pass: "p", host: "h", port: "7777" }),
    buildProxyUrl: () => "http://u:p@h:7777",
};
const mockCreds = { user: "u", pass: "p", host: "h", port: "7777" };
function makeFetchResponse(url, content) {
    return JSON.stringify({
        ok: true,
        tool: "novada_proxy_fetch",
        data: {
            url,
            status_code: 200,
            content,
        },
        meta: {
            latency_ms: 50,
            cache_hit: false,
            truncated: false,
            quota: { credits_estimated: 1 },
        },
    });
}
// ─── validateSessionParams ───────────────────────────────────────────────────
describe("validateSessionParams", () => {
    it("accepts valid params with defaults", () => {
        const p = validateSessionParams({ session_id: "abc123", url: "https://example.com" });
        expect(p.session_id).toBe("abc123");
        expect(p.url).toBe("https://example.com");
        expect(p.format).toBe("markdown");
        expect(p.timeout).toBe(60);
        expect(p.verify_sticky).toBe(false);
    });
    it("rejects missing session_id", () => {
        expect(() => validateSessionParams({ url: "https://example.com" })).toThrow("session_id is required");
    });
    it("rejects session_id with hyphens", () => {
        expect(() => validateSessionParams({ session_id: "my-session", url: "https://example.com" })).toThrow("session_id is required");
    });
    it("rejects session_id over 64 chars", () => {
        const longId = "a".repeat(65);
        expect(() => validateSessionParams({ session_id: longId, url: "https://example.com" })).toThrow("session_id is required");
    });
    it("rejects missing url", () => {
        expect(() => validateSessionParams({ session_id: "abc" })).toThrow("url is required");
    });
    it("rejects non-http url", () => {
        expect(() => validateSessionParams({ session_id: "abc", url: "ftp://example.com" })).toThrow("url must start with http://");
    });
    it("rejects country with hyphens", () => {
        expect(() => validateSessionParams({ session_id: "abc", url: "https://example.com", country: "us-east" })).toThrow("country must be a 2-letter ISO code");
    });
    it("rejects city with special characters", () => {
        expect(() => validateSessionParams({ session_id: "abc", url: "https://example.com", city: "new-york" })).toThrow("city must contain only letters");
    });
    it("rejects invalid format", () => {
        expect(() => validateSessionParams({ session_id: "abc", url: "https://example.com", format: "html" })).toThrow("format must be 'raw' or 'markdown'");
    });
    it("rejects timeout out of range", () => {
        expect(() => validateSessionParams({ session_id: "abc", url: "https://example.com", timeout: 0 })).toThrow("timeout must be between 1 and 120");
    });
    it("accepts verify_sticky=true", () => {
        const p = validateSessionParams({
            session_id: "abc",
            url: "https://example.com",
            verify_sticky: true,
        });
        expect(p.verify_sticky).toBe(true);
    });
    it("accepts valid country and city", () => {
        const p = validateSessionParams({
            session_id: "abc",
            url: "https://example.com",
            country: "US",
            city: "newyork",
        });
        expect(p.country).toBe("US");
        expect(p.city).toBe("newyork");
    });
});
// ─── novadaProxySession ──────────────────────────────────────────────────────
describe("novadaProxySession", () => {
    beforeEach(() => {
        novadaProxyFetchSpy.mockReset();
        axiosGetSpy.mockReset();
    });
    it("returns content with session_id in meta", async () => {
        novadaProxyFetchSpy.mockResolvedValueOnce(makeFetchResponse("https://example.com", "# Hello World"));
        const raw = await novadaProxySession({ session_id: "mysession", url: "https://example.com" }, mockAdapter, mockCreds);
        const result = JSON.parse(raw);
        expect(result.ok).toBe(true);
        expect(result.tool).toBe("novada_proxy_session");
        expect(result.meta.session_id).toBe("mysession");
        expect(result.data.content).toBe("# Hello World");
    });
    it("passes session_id to novadaProxyFetch", async () => {
        novadaProxyFetchSpy.mockResolvedValueOnce(makeFetchResponse("https://example.com", "content"));
        await novadaProxySession({ session_id: "test123", url: "https://example.com", country: "US" }, mockAdapter, mockCreds);
        expect(novadaProxyFetchSpy).toHaveBeenCalledWith(expect.objectContaining({
            url: "https://example.com",
            session_id: "test123",
            country: "US",
            format: "markdown",
        }), mockAdapter, mockCreds);
    });
    it("does not verify sticky by default", async () => {
        novadaProxyFetchSpy.mockResolvedValueOnce(makeFetchResponse("https://example.com", "content"));
        const raw = await novadaProxySession({ session_id: "s1", url: "https://example.com" }, mockAdapter, mockCreds);
        const result = JSON.parse(raw);
        expect(result.meta.session_verified).toBeUndefined();
        expect(result.meta.quota?.credits_estimated).toBe(1);
        // axios.get should not be called for httpbin verification
        expect(axiosGetSpy).not.toHaveBeenCalled();
    });
    it("verifies sticky session when verify_sticky=true", async () => {
        novadaProxyFetchSpy.mockResolvedValueOnce(makeFetchResponse("https://example.com", "content"));
        // Two httpbin.org/ip calls returning the same IP
        axiosGetSpy
            .mockResolvedValueOnce({ data: { origin: "1.2.3.4" } })
            .mockResolvedValueOnce({ data: { origin: "1.2.3.4" } });
        const raw = await novadaProxySession({ session_id: "sticky1", url: "https://example.com", verify_sticky: true }, mockAdapter, mockCreds);
        const result = JSON.parse(raw);
        expect(result.meta.session_verified).toBe(true);
        expect(result.meta.quota?.credits_estimated).toBe(3);
        expect(axiosGetSpy).toHaveBeenCalledTimes(2);
    });
    it("reports session_verified=false when IPs differ", async () => {
        novadaProxyFetchSpy.mockResolvedValueOnce(makeFetchResponse("https://example.com", "content"));
        // Two httpbin calls return different IPs
        axiosGetSpy
            .mockResolvedValueOnce({ data: { origin: "1.2.3.4" } })
            .mockResolvedValueOnce({ data: { origin: "5.6.7.8" } });
        const raw = await novadaProxySession({ session_id: "sticky2", url: "https://example.com", verify_sticky: true }, mockAdapter, mockCreds);
        const result = JSON.parse(raw);
        expect(result.meta.session_verified).toBe(false);
    });
    it("reports session_verified=false when verification calls fail", async () => {
        novadaProxyFetchSpy.mockResolvedValueOnce(makeFetchResponse("https://example.com", "content"));
        axiosGetSpy.mockRejectedValueOnce(new Error("Network error"));
        const raw = await novadaProxySession({ session_id: "sticky3", url: "https://example.com", verify_sticky: true }, mockAdapter, mockCreds);
        const result = JSON.parse(raw);
        expect(result.meta.session_verified).toBe(false);
    });
    it("returns raw fetch result when JSON parsing fails", async () => {
        novadaProxyFetchSpy.mockResolvedValueOnce("not-json-content");
        const raw = await novadaProxySession({ session_id: "s1", url: "https://example.com" }, mockAdapter, mockCreds);
        expect(raw).toBe("not-json-content");
    });
    it("skips verification when adapter lacks sticky capability", async () => {
        const noStickyAdapter = {
            ...mockAdapter,
            capabilities: { country: true, city: true, sticky: false },
        };
        novadaProxyFetchSpy.mockResolvedValueOnce(makeFetchResponse("https://example.com", "content"));
        const raw = await novadaProxySession({ session_id: "s1", url: "https://example.com", verify_sticky: true }, noStickyAdapter, mockCreds);
        const result = JSON.parse(raw);
        // Should not verify since adapter doesn't support sticky
        expect(result.meta.session_verified).toBeUndefined();
        expect(axiosGetSpy).not.toHaveBeenCalled();
        // Credits still 3 because verify_sticky was requested (even though it wasn't performed)
        expect(result.meta.quota?.credits_estimated).toBe(3);
    });
    it("uses format from params or defaults to markdown", async () => {
        novadaProxyFetchSpy.mockResolvedValueOnce(makeFetchResponse("https://example.com", "<html>raw</html>"));
        await novadaProxySession({ session_id: "s1", url: "https://example.com", format: "raw" }, mockAdapter, mockCreds);
        expect(novadaProxyFetchSpy).toHaveBeenCalledWith(expect.objectContaining({ format: "raw" }), mockAdapter, mockCreds);
    });
});
