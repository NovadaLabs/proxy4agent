import { describe, it, expect, afterEach } from "vitest";
import { getCacheTtl, makeCacheKey, clearResponseCache } from "../tools/fetch.js";
// ─── getCacheTtl ──────────────────────────────────────────────────────────────
describe("getCacheTtl", () => {
    const OLD = process.env.PROXY4AGENT_CACHE_TTL_SECONDS;
    afterEach(() => {
        if (OLD === undefined) {
            delete process.env.PROXY4AGENT_CACHE_TTL_SECONDS;
        }
        else {
            process.env.PROXY4AGENT_CACHE_TTL_SECONDS = OLD;
        }
    });
    it("returns 300 when env var is unset", () => {
        delete process.env.PROXY4AGENT_CACHE_TTL_SECONDS;
        expect(getCacheTtl()).toBe(300);
    });
    it("returns env var value when set to a valid number", () => {
        process.env.PROXY4AGENT_CACHE_TTL_SECONDS = "60";
        expect(getCacheTtl()).toBe(60);
    });
    it("returns 0 when set to 0 (disables cache)", () => {
        process.env.PROXY4AGENT_CACHE_TTL_SECONDS = "0";
        expect(getCacheTtl()).toBe(0);
    });
    it("falls back to 300 when env var is NaN", () => {
        process.env.PROXY4AGENT_CACHE_TTL_SECONDS = "notanumber";
        expect(getCacheTtl()).toBe(300);
    });
    it("falls back to 300 when env var is negative", () => {
        process.env.PROXY4AGENT_CACHE_TTL_SECONDS = "-10";
        expect(getCacheTtl()).toBe(300);
    });
});
// ─── makeCacheKey ─────────────────────────────────────────────────────────────
describe("makeCacheKey", () => {
    it("produces unique keys for different URLs", () => {
        const k1 = makeCacheKey("https://example.com", "markdown");
        const k2 = makeCacheKey("https://other.com", "markdown");
        expect(k1).not.toBe(k2);
    });
    it("produces unique keys for different formats", () => {
        const k1 = makeCacheKey("https://example.com", "markdown");
        const k2 = makeCacheKey("https://example.com", "raw");
        expect(k1).not.toBe(k2);
    });
    it("produces unique keys for different countries", () => {
        const k1 = makeCacheKey("https://example.com", "markdown", "US");
        const k2 = makeCacheKey("https://example.com", "markdown", "DE");
        expect(k1).not.toBe(k2);
    });
    it("treats undefined country the same as empty string", () => {
        const k1 = makeCacheKey("https://example.com", "markdown", undefined);
        const k2 = makeCacheKey("https://example.com", "markdown");
        expect(k1).toBe(k2);
    });
    it("produces the same key for identical inputs", () => {
        expect(makeCacheKey("https://x.com/page", "raw", "JP"))
            .toBe(makeCacheKey("https://x.com/page", "raw", "JP"));
    });
});
// ─── clearResponseCache ───────────────────────────────────────────────────────
describe("clearResponseCache", () => {
    it("is callable without error", () => {
        expect(() => clearResponseCache()).not.toThrow();
    });
});
