import { vi, describe, it, expect, beforeEach } from "vitest";
import { validateCrawlParams, agentproxyCrawl } from "../tools/crawl.js";
// ─── Mocks ────────────────────────────────────────────────────────────────────
const { agentproxyFetchSpy } = vi.hoisted(() => ({
    agentproxyFetchSpy: vi.fn(),
}));
vi.mock("../tools/fetch.js", () => ({
    agentproxyFetch: agentproxyFetchSpy,
}));
// ─── Test fixtures ────────────────────────────────────────────────────────────
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
// ─── validateCrawlParams ──────────────────────────────────────────────────────
describe("validateCrawlParams", () => {
    it("accepts valid url with defaults", () => {
        const p = validateCrawlParams({ url: "https://example.com" });
        expect(p.url).toBe("https://example.com");
        expect(p.depth).toBe(2);
        expect(p.limit).toBe(50);
        expect(p.include_content).toBe(false);
        expect(p.timeout).toBe(60);
        expect(p.format).toBe("markdown");
    });
    it("rejects missing url", () => {
        expect(() => validateCrawlParams({})).toThrow("url is required");
    });
    it("rejects non-http url", () => {
        expect(() => validateCrawlParams({ url: "ftp://example.com" })).toThrow("url must start with http://");
    });
    it("rejects depth below 1", () => {
        expect(() => validateCrawlParams({ url: "https://example.com", depth: 0 })).toThrow("depth must be between 1 and 5");
    });
    it("rejects depth above 5", () => {
        expect(() => validateCrawlParams({ url: "https://example.com", depth: 6 })).toThrow("depth must be between 1 and 5");
    });
    it("rejects limit below 10", () => {
        expect(() => validateCrawlParams({ url: "https://example.com", limit: 9 })).toThrow("limit must be between 10 and 200");
    });
    it("rejects limit above 200", () => {
        expect(() => validateCrawlParams({ url: "https://example.com", limit: 201 })).toThrow("limit must be between 10 and 200");
    });
    it("rejects country with hyphens", () => {
        expect(() => validateCrawlParams({ url: "https://example.com", country: "us-injected" })).toThrow("country must be a 2-letter ISO code");
    });
    it("rejects timeout out of range", () => {
        expect(() => validateCrawlParams({ url: "https://example.com", timeout: 0 })).toThrow("timeout must be between 1 and 120");
        expect(() => validateCrawlParams({ url: "https://example.com", timeout: 121 })).toThrow("timeout must be between 1 and 120");
    });
    it("defaults depth to 2", () => {
        const p = validateCrawlParams({ url: "https://example.com" });
        expect(p.depth).toBe(2);
    });
    it("defaults limit to 50", () => {
        const p = validateCrawlParams({ url: "https://example.com" });
        expect(p.limit).toBe(50);
    });
    it("defaults include_content to false", () => {
        const p = validateCrawlParams({ url: "https://example.com" });
        expect(p.include_content).toBe(false);
    });
    it("passes include_content:true through", () => {
        const p = validateCrawlParams({ url: "https://example.com", include_content: true });
        expect(p.include_content).toBe(true);
    });
    it("accepts valid depth within range", () => {
        expect(validateCrawlParams({ url: "https://example.com", depth: 1 }).depth).toBe(1);
        expect(validateCrawlParams({ url: "https://example.com", depth: 5 }).depth).toBe(5);
    });
    it("accepts valid limit within range", () => {
        expect(validateCrawlParams({ url: "https://example.com", limit: 10 }).limit).toBe(10);
        expect(validateCrawlParams({ url: "https://example.com", limit: 200 }).limit).toBe(200);
    });
    it("accepts valid country code", () => {
        const p = validateCrawlParams({ url: "https://example.com", country: "US" });
        expect(p.country).toBe("US");
    });
    it("rejects invalid format", () => {
        expect(() => validateCrawlParams({ url: "https://example.com", format: "html" })).toThrow("format must be 'raw' or 'markdown'");
    });
    it("accepts format raw", () => {
        const p = validateCrawlParams({ url: "https://example.com", format: "raw" });
        expect(p.format).toBe("raw");
    });
});
// ─── agentproxyCrawl integration ─────────────────────────────────────────────
function makeFetchResponse(url, html, statusCode = 200, cacheHit = false) {
    return JSON.stringify({
        ok: true,
        tool: "agentproxy_fetch",
        data: {
            url,
            status_code: statusCode,
            content: html,
        },
        meta: {
            latency_ms: 50,
            cache_hit: cacheHit,
            truncated: false,
            quota: { credits_estimated: 1, note: "" },
        },
    });
}
describe("agentproxyCrawl", () => {
    beforeEach(() => {
        agentproxyFetchSpy.mockReset();
    });
    it("returns valid JSON with correct tool name", async () => {
        agentproxyFetchSpy.mockResolvedValue(makeFetchResponse("https://example.com", "<html><body>Hello</body></html>"));
        const raw = await agentproxyCrawl({ url: "https://example.com", depth: 1, limit: 10 }, mockAdapter, mockCreds);
        const result = JSON.parse(raw);
        expect(result.ok).toBe(true);
        expect(result.tool).toBe("agentproxy_crawl");
    });
    it("includes start_url and domain in data", async () => {
        agentproxyFetchSpy.mockResolvedValue(makeFetchResponse("https://example.com", "<html><body>Hello</body></html>"));
        const raw = await agentproxyCrawl({ url: "https://example.com", depth: 1, limit: 10 }, mockAdapter, mockCreds);
        const result = JSON.parse(raw);
        expect(result.data.start_url).toBe("https://example.com");
        expect(result.data.domain).toBe("example.com");
    });
    it("crawls at least the start URL", async () => {
        agentproxyFetchSpy.mockResolvedValue(makeFetchResponse("https://example.com", "<html><body>No links</body></html>"));
        const raw = await agentproxyCrawl({ url: "https://example.com", depth: 1, limit: 10 }, mockAdapter, mockCreds);
        const result = JSON.parse(raw);
        expect(result.data.urls_crawled).toBe(1);
        expect(result.data.pages).toHaveLength(1);
        expect(result.data.pages[0].url).toBe("https://example.com");
        expect(result.data.pages[0].depth).toBe(0);
    });
    it("follows internal links up to depth limit", async () => {
        // Root page has 2 internal links
        const rootHtml = `<html><body>
      <a href="/page1">Page 1</a>
      <a href="/page2">Page 2</a>
    </body></html>`;
        agentproxyFetchSpy
            .mockResolvedValueOnce(makeFetchResponse("https://example.com", rootHtml))
            .mockResolvedValueOnce(makeFetchResponse("https://example.com/page1", "<html><body>Page 1</body></html>"))
            .mockResolvedValueOnce(makeFetchResponse("https://example.com/page2", "<html><body>Page 2</body></html>"));
        const raw = await agentproxyCrawl({ url: "https://example.com", depth: 1, limit: 10 }, mockAdapter, mockCreds);
        const result = JSON.parse(raw);
        expect(result.data.urls_crawled).toBe(3);
        expect(result.data.depth_reached).toBe(1);
    });
    it("does not follow external links", async () => {
        const rootHtml = `<html><body>
      <a href="https://external.com/page">External</a>
      <a href="/internal">Internal</a>
    </body></html>`;
        agentproxyFetchSpy
            .mockResolvedValueOnce(makeFetchResponse("https://example.com", rootHtml))
            .mockResolvedValueOnce(makeFetchResponse("https://example.com/internal", "<html><body>Internal</body></html>"));
        const raw = await agentproxyCrawl({ url: "https://example.com", depth: 1, limit: 10 }, mockAdapter, mockCreds);
        const result = JSON.parse(raw);
        // Only example.com and /internal crawled — external.com excluded
        expect(result.data.urls_crawled).toBe(2);
    });
    it("respects limit parameter", async () => {
        // Root page with many links, limit=1 means only root is crawled
        const manyLinksHtml = Array.from({ length: 20 }, (_, i) => `<a href="/page${i}">Page ${i}</a>`).join("\n");
        const rootHtml = `<html><body>${manyLinksHtml}</body></html>`;
        agentproxyFetchSpy.mockResolvedValue(makeFetchResponse("https://example.com", rootHtml));
        const raw = await agentproxyCrawl({ url: "https://example.com", depth: 2, limit: 10 }, mockAdapter, mockCreds);
        const result = JSON.parse(raw);
        expect(result.data.urls_crawled).toBeLessThanOrEqual(10);
    });
    it("records errors per page but continues crawling", async () => {
        const rootHtml = `<html><body>
      <a href="/good">Good</a>
      <a href="/bad">Bad</a>
    </body></html>`;
        agentproxyFetchSpy
            .mockResolvedValueOnce(makeFetchResponse("https://example.com", rootHtml))
            .mockResolvedValueOnce(makeFetchResponse("https://example.com/good", "<html><body>Good</body></html>"))
            .mockRejectedValueOnce(new Error("Network error"));
        const raw = await agentproxyCrawl({ url: "https://example.com", depth: 1, limit: 10 }, mockAdapter, mockCreds);
        const result = JSON.parse(raw);
        expect(result.ok).toBe(true);
        expect(result.data.urls_crawled).toBe(3);
        const failedPage = result.data.pages.find((p) => p.error !== undefined);
        expect(failedPage).toBeDefined();
        expect(failedPage.error).toContain("Network error");
    });
    it("does not revisit already-visited URLs", async () => {
        // Both sub-pages link back to root
        const rootHtml = `<html><body><a href="/sub">Sub</a></body></html>`;
        const subHtml = `<html><body><a href="/">Back to root</a></body></html>`;
        agentproxyFetchSpy
            .mockResolvedValueOnce(makeFetchResponse("https://example.com", rootHtml))
            .mockResolvedValueOnce(makeFetchResponse("https://example.com/sub", subHtml));
        const raw = await agentproxyCrawl({ url: "https://example.com", depth: 2, limit: 10 }, mockAdapter, mockCreds);
        const result = JSON.parse(raw);
        // Root should only be visited once despite sub linking back
        expect(result.data.urls_crawled).toBe(2);
        // agentproxyFetch called exactly twice
        expect(agentproxyFetchSpy).toHaveBeenCalledTimes(2);
    });
    it("includes content when include_content is true", async () => {
        const html = "<html><body>Page content here</body></html>";
        agentproxyFetchSpy.mockResolvedValue(makeFetchResponse("https://example.com", html));
        const raw = await agentproxyCrawl({ url: "https://example.com", depth: 1, limit: 10, include_content: true, format: "raw" }, mockAdapter, mockCreds);
        const result = JSON.parse(raw);
        const page = result.data.pages[0];
        expect(page.content).toBeDefined();
    });
    it("includes sitemap_hint when sitemap not crawled", async () => {
        agentproxyFetchSpy.mockResolvedValue(makeFetchResponse("https://example.com", "<html><body>No links</body></html>"));
        const raw = await agentproxyCrawl({ url: "https://example.com", depth: 1, limit: 10 }, mockAdapter, mockCreds);
        const result = JSON.parse(raw);
        expect(result.data.sitemap_hint).toContain("sitemap.xml");
    });
    it("includes latency_ms in meta", async () => {
        agentproxyFetchSpy.mockResolvedValue(makeFetchResponse("https://example.com", "<html><body>Hello</body></html>"));
        const raw = await agentproxyCrawl({ url: "https://example.com", depth: 1, limit: 10 }, mockAdapter, mockCreds);
        const result = JSON.parse(raw);
        expect(typeof result.meta.latency_ms).toBe("number");
        expect(result.meta.latency_ms).toBeGreaterThanOrEqual(0);
    });
    it("throws for an invalid start URL", async () => {
        await expect(agentproxyCrawl({ url: "not-a-url", depth: 1, limit: 10 }, mockAdapter, mockCreds)).rejects.toThrow("Invalid URL");
    });
    it("counts credits as pages minus cache hits", async () => {
        agentproxyFetchSpy
            .mockResolvedValueOnce(makeFetchResponse("https://example.com", "<html><body>Hello</body></html>", 200, false));
        const raw = await agentproxyCrawl({ url: "https://example.com", depth: 1, limit: 10 }, mockAdapter, mockCreds);
        const result = JSON.parse(raw);
        expect(result.meta.quota.credits_estimated).toBe(1); // 1 page, 0 cache hits
    });
    // ─── F2 fix tests: field should be new_links not links_found ─────────────────
    it("should use 'new_links' field name (not 'links_found') in page results", async () => {
        const rootHtml = `<html><body>
      <a href="/page1">Page 1</a>
      <a href="/page2">Page 2</a>
    </body></html>`;
        agentproxyFetchSpy.mockResolvedValue(makeFetchResponse("https://example.com", rootHtml));
        const raw = await agentproxyCrawl({ url: "https://example.com", depth: 1, limit: 10 }, mockAdapter, mockCreds);
        const result = JSON.parse(raw);
        const page = result.data.pages[0];
        // After F2's fix: field is new_links, not links_found
        expect(page).toHaveProperty("new_links");
        expect(page).not.toHaveProperty("links_found");
        expect(page.new_links).toBeGreaterThanOrEqual(0);
    });
    // ─── F2 fix tests: total_links field should exist ────────────────────────────
    it("should include 'total_links' count per page", async () => {
        // Page with 3 links: 2 internal (one duplicate) + 1 external
        const rootHtml = `<html><body>
      <a href="/page1">Page 1</a>
      <a href="/page2">Page 2</a>
      <a href="/page1">Page 1 again</a>
      <a href="https://external.com">External</a>
    </body></html>`;
        agentproxyFetchSpy.mockResolvedValue(makeFetchResponse("https://example.com", rootHtml));
        const raw = await agentproxyCrawl({ url: "https://example.com", depth: 1, limit: 10 }, mockAdapter, mockCreds);
        const result = JSON.parse(raw);
        const page = result.data.pages[0];
        // total_links counts all internal links on the page (deduplicated within page)
        expect(page).toHaveProperty("total_links");
        expect(typeof page.total_links).toBe("number");
        // Exactly 2 unique internal links on this page (/page1 and /page2)
        expect(page.total_links).toBe(2);
    });
    // ─── F2 fix tests: credit counting with double fetches ───────────────────────
    it("should estimate 2x credits when include_content=true and format=markdown", async () => {
        // When include_content=true and format=markdown, two fetches happen per page:
        // one for markdown content, one for raw HTML (link extraction).
        // Credits should reflect the double-fetch overhead.
        const rootHtml = `<html><body>
      <a href="/page1">Page 1</a>
    </body></html>`;
        // First call: markdown fetch for root
        // Second call: raw fetch for root (link extraction)
        // Third call: markdown fetch for /page1
        // Fourth call: raw fetch for /page1 (link extraction)
        agentproxyFetchSpy
            .mockResolvedValueOnce(makeFetchResponse("https://example.com", "# Root", 200, false))
            .mockResolvedValueOnce(makeFetchResponse("https://example.com", rootHtml, 200, false))
            .mockResolvedValueOnce(makeFetchResponse("https://example.com/page1", "# Page 1", 200, false))
            .mockResolvedValueOnce(makeFetchResponse("https://example.com/page1", "<html><body>Page 1</body></html>", 200, false));
        const raw = await agentproxyCrawl({ url: "https://example.com", depth: 1, limit: 10, include_content: true, format: "markdown" }, mockAdapter, mockCreds);
        const result = JSON.parse(raw);
        // 2 pages, 0 cache hits, 2 extra raw fetches = 2 - 0 + 2 = 4 credits
        expect(result.meta.quota.credits_estimated).toBe(4);
    });
});
