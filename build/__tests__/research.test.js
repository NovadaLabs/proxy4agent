import { vi, describe, it, expect, beforeEach } from "vitest";
import { validateResearchParams, novadaProxyResearch } from "../tools/research.js";
// ─── Mocks ──────────────────────────────────────────────────────────────────
const { novadaProxySearchSpy, novadaProxyBatchFetchSpy, novadaProxyFetchSpy } = vi.hoisted(() => ({
    novadaProxySearchSpy: vi.fn(),
    novadaProxyBatchFetchSpy: vi.fn(),
    novadaProxyFetchSpy: vi.fn(),
}));
vi.mock("../tools/search.js", () => ({
    novadaProxySearch: novadaProxySearchSpy,
}));
vi.mock("../tools/batch.js", () => ({
    novadaProxyBatchFetch: novadaProxyBatchFetchSpy,
}));
vi.mock("../tools/fetch.js", () => ({
    novadaProxyFetch: novadaProxyFetchSpy,
}));
// ─── Test fixtures ──────────────────────────────────────────────────────────
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
const mockApiKey = "test-api-key";
// ─── Helpers ────────────────────────────────────────────────────────────────
function makeSearchResponse(results) {
    return JSON.stringify({
        ok: true,
        tool: "novada_proxy_search",
        data: {
            query: "test query",
            engine: "google",
            count: results.length,
            results,
        },
        meta: {
            latency_ms: 100,
            quota: { credits_estimated: 1, note: "" },
        },
    });
}
function makeBatchResponse(results) {
    return JSON.stringify({
        ok: true,
        tool: "novada_proxy_batch_fetch",
        data: {
            requested: results.length,
            succeeded: results.filter(r => r.ok).length,
            failed: results.filter(r => !r.ok).length,
            results,
        },
        meta: {
            latency_ms: 200,
            concurrency: 3,
            quota: { credits_estimated: results.length, note: "" },
        },
    });
}
// ─── validateResearchParams ─────────────────────────────────────────────────
describe("validateResearchParams", () => {
    it("accepts valid query with defaults", () => {
        const p = validateResearchParams({ query: "AI agent tools" });
        expect(p.query).toBe("AI agent tools");
        expect(p.depth).toBe("standard");
        expect(p.timeout).toBe(60);
        expect(p.country).toBeUndefined();
    });
    it("rejects missing query", () => {
        expect(() => validateResearchParams({})).toThrow("query is required");
    });
    it("rejects non-string query", () => {
        expect(() => validateResearchParams({ query: 123 })).toThrow("query is required");
    });
    it("rejects query over 500 characters", () => {
        expect(() => validateResearchParams({ query: "x".repeat(501) })).toThrow("query must be 500 characters or less");
    });
    it("accepts valid depth values", () => {
        expect(validateResearchParams({ query: "test", depth: "quick" }).depth).toBe("quick");
        expect(validateResearchParams({ query: "test", depth: "standard" }).depth).toBe("standard");
        expect(validateResearchParams({ query: "test", depth: "deep" }).depth).toBe("deep");
    });
    it("rejects invalid depth", () => {
        expect(() => validateResearchParams({ query: "test", depth: "ultra" })).toThrow("depth must be 'quick', 'standard', or 'deep'");
    });
    it("rejects country with hyphens", () => {
        expect(() => validateResearchParams({ query: "test", country: "us-injected" })).toThrow("country must be a 2-letter ISO code");
    });
    it("accepts valid country code", () => {
        const p = validateResearchParams({ query: "test", country: "US" });
        expect(p.country).toBe("US");
    });
    it("rejects timeout out of range", () => {
        expect(() => validateResearchParams({ query: "test", timeout: 0 })).toThrow("timeout must be between 1 and 120");
        expect(() => validateResearchParams({ query: "test", timeout: 121 })).toThrow("timeout must be between 1 and 120");
    });
    it("accepts valid timeout", () => {
        const p = validateResearchParams({ query: "test", timeout: 30 });
        expect(p.timeout).toBe(30);
    });
});
// ─── novadaProxyResearch ────────────────────────────────────────────────────
describe("novadaProxyResearch", () => {
    beforeEach(() => {
        novadaProxySearchSpy.mockReset();
        novadaProxyBatchFetchSpy.mockReset();
        novadaProxyFetchSpy.mockReset();
    });
    it("returns valid JSON with correct tool name", async () => {
        novadaProxySearchSpy.mockResolvedValue(makeSearchResponse([
            { title: "Result 1", url: "https://example.com/1", snippet: "Snippet 1" },
            { title: "Result 2", url: "https://example.com/2", snippet: "Snippet 2" },
        ]));
        novadaProxyBatchFetchSpy.mockResolvedValue(makeBatchResponse([
            { url: "https://example.com/1", ok: true, content: "# Page 1\n\nContent of page 1" },
            { url: "https://example.com/2", ok: true, content: "# Page 2\n\nContent of page 2" },
        ]));
        const raw = await novadaProxyResearch({ query: "test query" }, mockAdapter, mockCreds, mockApiKey);
        const result = JSON.parse(raw);
        expect(result.ok).toBe(true);
        expect(result.tool).toBe("novada_proxy_research");
    });
    it("uses quick depth (3 sources)", async () => {
        const searchResults = Array.from({ length: 10 }, (_, i) => ({
            title: `Result ${i}`,
            url: `https://example.com/${i}`,
            snippet: `Snippet ${i}`,
        }));
        novadaProxySearchSpy.mockResolvedValue(makeSearchResponse(searchResults));
        novadaProxyBatchFetchSpy.mockResolvedValue(makeBatchResponse([
            { url: "https://example.com/0", ok: true, content: "Page 0" },
            { url: "https://example.com/1", ok: true, content: "Page 1" },
            { url: "https://example.com/2", ok: true, content: "Page 2" },
        ]));
        const raw = await novadaProxyResearch({ query: "test", depth: "quick" }, mockAdapter, mockCreds, mockApiKey);
        const result = JSON.parse(raw);
        expect(result.data.depth).toBe("quick");
        // Search was called with num=3
        expect(novadaProxySearchSpy).toHaveBeenCalledWith(expect.objectContaining({ num: 3 }), mockApiKey);
    });
    it("uses standard depth (5 sources)", async () => {
        novadaProxySearchSpy.mockResolvedValue(makeSearchResponse([]));
        await novadaProxyResearch({ query: "test", depth: "standard" }, mockAdapter, mockCreds, mockApiKey);
        expect(novadaProxySearchSpy).toHaveBeenCalledWith(expect.objectContaining({ num: 5 }), mockApiKey);
    });
    it("uses deep depth (10 sources)", async () => {
        novadaProxySearchSpy.mockResolvedValue(makeSearchResponse([]));
        await novadaProxyResearch({ query: "test", depth: "deep" }, mockAdapter, mockCreds, mockApiKey);
        expect(novadaProxySearchSpy).toHaveBeenCalledWith(expect.objectContaining({ num: 10 }), mockApiKey);
    });
    it("handles empty search results gracefully", async () => {
        novadaProxySearchSpy.mockResolvedValue(makeSearchResponse([]));
        const raw = await novadaProxyResearch({ query: "obscure topic" }, mockAdapter, mockCreds, mockApiKey);
        const result = JSON.parse(raw);
        expect(result.ok).toBe(true);
        expect(result.data.sources_searched).toBe(0);
        expect(result.data.sources_fetched).toBe(0);
        expect(result.data.findings).toHaveLength(0);
        expect(result.data.findings_summary).toContain("No search results");
        // Batch fetch should not have been called
        expect(novadaProxyBatchFetchSpy).not.toHaveBeenCalled();
    });
    it("handles partial fetch failures", async () => {
        novadaProxySearchSpy.mockResolvedValue(makeSearchResponse([
            { title: "Good", url: "https://example.com/good", snippet: "Good snippet" },
            { title: "Bad", url: "https://example.com/bad", snippet: "Bad snippet" },
            { title: "Also Good", url: "https://example.com/also-good", snippet: "Another snippet" },
        ]));
        novadaProxyBatchFetchSpy.mockResolvedValue(makeBatchResponse([
            { url: "https://example.com/good", ok: true, content: "# Good Page\n\nGood content here" },
            { url: "https://example.com/bad", ok: false, error: { code: "TIMEOUT", message: "Request timed out" } },
            { url: "https://example.com/also-good", ok: true, content: "# Also Good\n\nMore good content" },
        ]));
        const raw = await novadaProxyResearch({ query: "test" }, mockAdapter, mockCreds, mockApiKey);
        const result = JSON.parse(raw);
        expect(result.ok).toBe(true);
        expect(result.data.sources_fetched).toBe(2);
        expect(result.data.sources_failed).toBe(1);
        expect(result.data.findings).toHaveLength(2);
    });
    it("constructs findings_summary from findings", async () => {
        novadaProxySearchSpy.mockResolvedValue(makeSearchResponse([
            { title: "Source A", url: "https://a.com", snippet: "A snippet" },
            { title: "Source B", url: "https://b.com", snippet: "B snippet" },
        ]));
        novadaProxyBatchFetchSpy.mockResolvedValue(makeBatchResponse([
            { url: "https://a.com", ok: true, content: "# Alpha\n\nAlpha provides excellent coverage." },
            { url: "https://b.com", ok: true, content: "# Beta\n\nBeta offers competitive pricing." },
        ]));
        const raw = await novadaProxyResearch({ query: "comparison" }, mockAdapter, mockCreds, mockApiKey);
        const result = JSON.parse(raw);
        expect(result.data.findings_summary).toContain("According to Alpha");
        expect(result.data.findings_summary).toContain("According to Beta");
        expect(result.data.findings_summary).toContain("excellent coverage");
        expect(result.data.findings_summary).toContain("competitive pricing");
    });
    it("includes correct response format fields", async () => {
        novadaProxySearchSpy.mockResolvedValue(makeSearchResponse([
            { title: "R1", url: "https://example.com/1", snippet: "S1" },
            { title: "R2", url: "https://example.com/2", snippet: "S2" },
        ]));
        novadaProxyBatchFetchSpy.mockResolvedValue(makeBatchResponse([
            { url: "https://example.com/1", ok: true, content: "# Title 1\n\nContent 1" },
            { url: "https://example.com/2", ok: true, content: "# Title 2\n\nContent 2" },
        ]));
        const raw = await novadaProxyResearch({ query: "test" }, mockAdapter, mockCreds, mockApiKey);
        const result = JSON.parse(raw);
        // Top-level envelope
        expect(result).toHaveProperty("ok", true);
        expect(result).toHaveProperty("tool", "novada_proxy_research");
        expect(result).toHaveProperty("data");
        expect(result).toHaveProperty("meta");
        // Data fields
        expect(result.data).toHaveProperty("query");
        expect(result.data).toHaveProperty("depth");
        expect(result.data).toHaveProperty("sources_searched");
        expect(result.data).toHaveProperty("sources_fetched");
        expect(result.data).toHaveProperty("sources_failed");
        expect(result.data).toHaveProperty("findings");
        expect(result.data).toHaveProperty("urls");
        expect(result.data).toHaveProperty("findings_summary");
        // Meta fields
        expect(result.meta).toHaveProperty("latency_ms");
        expect(result.meta).toHaveProperty("quota");
        expect(result.meta.quota).toHaveProperty("credits_estimated");
        // Findings structure
        const finding = result.data.findings[0];
        expect(finding).toHaveProperty("title");
        expect(finding).toHaveProperty("url");
        expect(finding).toHaveProperty("snippet");
        expect(finding).toHaveProperty("content_preview");
    });
    it("handles search failure by propagating error", async () => {
        novadaProxySearchSpy.mockRejectedValue(new Error("Search API HTTP 500: internal error"));
        await expect(novadaProxyResearch({ query: "test" }, mockAdapter, mockCreds, mockApiKey)).rejects.toThrow("Search API HTTP 500");
    });
    it("extracts title from markdown heading", async () => {
        novadaProxySearchSpy.mockResolvedValue(makeSearchResponse([
            { title: "R1", url: "https://example.com/1", snippet: "S1" },
            { title: "R2", url: "https://example.com/2", snippet: "S2" },
        ]));
        novadaProxyBatchFetchSpy.mockResolvedValue(makeBatchResponse([
            { url: "https://example.com/1", ok: true, content: "# My Great Title\n\nContent here" },
            { url: "https://example.com/2", ok: true, content: "Just plain text\nMore text" },
        ]));
        const raw = await novadaProxyResearch({ query: "test" }, mockAdapter, mockCreds, mockApiKey);
        const result = JSON.parse(raw);
        expect(result.data.findings[0].title).toBe("My Great Title");
        // Second finding should use first line as title
        expect(result.data.findings[1].title).toBe("Just plain text");
    });
    it("limits content_preview to 500 characters", async () => {
        const longContent = "# Title\n\n" + "x".repeat(1000);
        novadaProxySearchSpy.mockResolvedValue(makeSearchResponse([
            { title: "R1", url: "https://example.com/1", snippet: "S1" },
            { title: "R2", url: "https://example.com/2", snippet: "S2" },
        ]));
        novadaProxyBatchFetchSpy.mockResolvedValue(makeBatchResponse([
            { url: "https://example.com/1", ok: true, content: longContent },
            { url: "https://example.com/2", ok: true, content: "short" },
        ]));
        const raw = await novadaProxyResearch({ query: "test" }, mockAdapter, mockCreds, mockApiKey);
        const result = JSON.parse(raw);
        expect(result.data.findings[0].content_preview.length).toBeLessThanOrEqual(500);
    });
    it("provides correct urls array", async () => {
        novadaProxySearchSpy.mockResolvedValue(makeSearchResponse([
            { title: "R1", url: "https://a.com", snippet: "S1" },
            { title: "R2", url: "https://b.com", snippet: "S2" },
            { title: "R3", url: "https://c.com", snippet: "S3" },
        ]));
        novadaProxyBatchFetchSpy.mockResolvedValue(makeBatchResponse([
            { url: "https://a.com", ok: true, content: "A" },
            { url: "https://b.com", ok: true, content: "B" },
            { url: "https://c.com", ok: true, content: "C" },
        ]));
        const raw = await novadaProxyResearch({ query: "test" }, mockAdapter, mockCreds, mockApiKey);
        const result = JSON.parse(raw);
        expect(result.data.urls).toEqual(["https://a.com", "https://b.com", "https://c.com"]);
    });
    it("estimates credits as 1 (search) + N (fetched URLs)", async () => {
        novadaProxySearchSpy.mockResolvedValue(makeSearchResponse([
            { title: "R1", url: "https://example.com/1", snippet: "S1" },
            { title: "R2", url: "https://example.com/2", snippet: "S2" },
            { title: "R3", url: "https://example.com/3", snippet: "S3" },
        ]));
        novadaProxyBatchFetchSpy.mockResolvedValue(makeBatchResponse([
            { url: "https://example.com/1", ok: true, content: "Page 1" },
            { url: "https://example.com/2", ok: true, content: "Page 2" },
            { url: "https://example.com/3", ok: false, error: { code: "TIMEOUT", message: "timeout" } },
        ]));
        const raw = await novadaProxyResearch({ query: "test" }, mockAdapter, mockCreds, mockApiKey);
        const result = JSON.parse(raw);
        // 1 search credit + 3 URLs attempted = 4
        expect(result.meta.quota.credits_estimated).toBe(4);
    });
    it("passes country parameter to search", async () => {
        novadaProxySearchSpy.mockResolvedValue(makeSearchResponse([]));
        await novadaProxyResearch({ query: "test", country: "DE" }, mockAdapter, mockCreds, mockApiKey);
        expect(novadaProxySearchSpy).toHaveBeenCalledWith(expect.objectContaining({ country: "DE" }), mockApiKey);
    });
    it("handles single search result (uses direct fetch instead of batch)", async () => {
        novadaProxySearchSpy.mockResolvedValue(makeSearchResponse([
            { title: "Only Result", url: "https://example.com/only", snippet: "The only one" },
        ]));
        // Single result uses novadaProxyFetch directly (batch requires min 2 URLs)
        novadaProxyFetchSpy.mockResolvedValue(JSON.stringify({
            ok: true,
            tool: "novada_proxy_fetch",
            data: { content: "# Only Page\n\nOnly content", status_code: 200 },
            meta: { latency_ms: 50, cache_hit: false },
        }));
        const raw = await novadaProxyResearch({ query: "niche topic", depth: "quick" }, mockAdapter, mockCreds, mockApiKey);
        const result = JSON.parse(raw);
        expect(result.ok).toBe(true);
        expect(result.data.sources_fetched).toBe(1);
        expect(result.data.findings).toHaveLength(1);
        // Batch should NOT have been called
        expect(novadaProxyBatchFetchSpy).not.toHaveBeenCalled();
    });
});
