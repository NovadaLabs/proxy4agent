import { describe, it, expect } from "vitest";
import { NovadaAdapter } from "../adapters/novada.js";
import { BrightDataAdapter } from "../adapters/brightdata.js";
import { SmartproxyAdapter } from "../adapters/smartproxy.js";
import { OxylabsAdapter } from "../adapters/oxylabs.js";
import { GenericHttpAdapter } from "../adapters/generic.js";
import { resolveAdapter, listAdapters } from "../adapters/index.js";
// ─── Novada ───────────────────────────────────────────────
describe("NovadaAdapter", () => {
    it("returns null when credentials missing", () => {
        expect(NovadaAdapter.loadCredentials({})).toBeNull();
        expect(NovadaAdapter.loadCredentials({ NOVADA_PROXY_USER: "u" })).toBeNull();
        expect(NovadaAdapter.loadCredentials({ NOVADA_PROXY_PASS: "p" })).toBeNull();
    });
    it("loads credentials with defaults", () => {
        const creds = NovadaAdapter.loadCredentials({
            NOVADA_PROXY_USER: "user1",
            NOVADA_PROXY_PASS: "pass1",
        });
        expect(creds).toEqual({
            user: "user1",
            pass: "pass1",
            host: "super.novada.pro",
            port: "7777",
            zone: "res",
        });
    });
    it("respects custom host and port", () => {
        const creds = NovadaAdapter.loadCredentials({
            NOVADA_PROXY_USER: "u",
            NOVADA_PROXY_PASS: "p",
            NOVADA_PROXY_HOST: "custom.host",
            NOVADA_PROXY_PORT: "9999",
        });
        expect(creds.host).toBe("custom.host");
        expect(creds.port).toBe("9999");
    });
    it("falls back to default port for invalid values", () => {
        for (const bad of ["0", "-1", "99999", "abc", ""]) {
            const creds = NovadaAdapter.loadCredentials({
                NOVADA_PROXY_USER: "u",
                NOVADA_PROXY_PASS: "p",
                NOVADA_PROXY_PORT: bad,
            });
            expect(creds.port).toBe("7777");
        }
    });
    it("builds proxy URL with region/city/session", () => {
        const creds = { user: "user1", pass: "p@ss", host: "h.com", port: "7777" };
        const url = NovadaAdapter.buildProxyUrl(creds, {
            country: "US",
            city: "NewYork",
            session_id: "abc123",
        });
        expect(url).toContain("user1-zone-res-region-us-city-newyork-session-abc123-sessTime-5");
        expect(url).toContain(encodeURIComponent("p@ss"));
        expect(url).toContain("h.com:7777");
    });
    it("builds proxy URL without targeting params", () => {
        const creds = { user: "user1", pass: "pass1", host: "h.com", port: "7777" };
        const url = NovadaAdapter.buildProxyUrl(creds, {});
        expect(url).toBe("http://user1-zone-res:pass1@h.com:7777");
    });
});
// ─── BrightData ───────────────────────────────────────────
describe("BrightDataAdapter", () => {
    it("returns null when credentials missing", () => {
        expect(BrightDataAdapter.loadCredentials({})).toBeNull();
    });
    it("loads credentials with defaults", () => {
        const creds = BrightDataAdapter.loadCredentials({
            BRIGHTDATA_USER: "brd-customer-abc",
            BRIGHTDATA_PASS: "pass",
        });
        expect(creds.host).toBe("zproxy.lum-superproxy.io");
        expect(creds.port).toBe("22225");
    });
    it("uses -country- for country and -sid- for session", () => {
        const creds = { user: "brd-abc", pass: "p", host: "h", port: "22225" };
        const url = BrightDataAdapter.buildProxyUrl(creds, {
            country: "US",
            session_id: "s1",
        });
        expect(url).toContain("brd-abc-country-us");
        expect(url).toContain("-sid-s1");
        expect(url).not.toContain("-session-");
    });
});
// ─── Smartproxy ───────────────────────────────────────────
describe("SmartproxyAdapter", () => {
    it("returns null when credentials missing", () => {
        expect(SmartproxyAdapter.loadCredentials({})).toBeNull();
    });
    it("loads defaults correctly", () => {
        const creds = SmartproxyAdapter.loadCredentials({
            SMARTPROXY_USER: "u",
            SMARTPROXY_PASS: "p",
        });
        expect(creds.host).toBe("gate.smartproxy.com");
        expect(creds.port).toBe("10001");
    });
    it("uppercases country code", () => {
        const creds = { user: "u", pass: "p", host: "h", port: "10001" };
        const url = SmartproxyAdapter.buildProxyUrl(creds, { country: "us" });
        expect(url).toContain("-country-US");
    });
});
// ─── Oxylabs ──────────────────────────────────────────────
describe("OxylabsAdapter", () => {
    it("returns null when credentials missing", () => {
        expect(OxylabsAdapter.loadCredentials({})).toBeNull();
    });
    it("loads defaults correctly", () => {
        const creds = OxylabsAdapter.loadCredentials({
            OXYLABS_USER: "u",
            OXYLABS_PASS: "p",
        });
        expect(creds.host).toBe("pr.oxylabs.io");
        expect(creds.port).toBe("7777");
    });
    it("uses -cc- for country (uppercase) and -sessid- for session", () => {
        const creds = { user: "u", pass: "p", host: "h", port: "7777" };
        const url = OxylabsAdapter.buildProxyUrl(creds, {
            country: "de",
            session_id: "sess1",
        });
        expect(url).toContain("-cc-DE");
        expect(url).toContain("-sessid-sess1");
    });
});
// ─── Generic ──────────────────────────────────────────────
describe("GenericHttpAdapter", () => {
    it("returns null when PROXY_URL not set", () => {
        expect(GenericHttpAdapter.loadCredentials({})).toBeNull();
    });
    it("returns null for non-http schemes", () => {
        expect(GenericHttpAdapter.loadCredentials({ PROXY_URL: "ftp://host" })).toBeNull();
        expect(GenericHttpAdapter.loadCredentials({ PROXY_URL: "socks5://host" })).toBeNull();
    });
    it("returns null for malformed URL", () => {
        expect(GenericHttpAdapter.loadCredentials({ PROXY_URL: "not-a-url" })).toBeNull();
    });
    it("parses a valid PROXY_URL", () => {
        const creds = GenericHttpAdapter.loadCredentials({
            PROXY_URL: "http://user:pass@host.com:8080",
        });
        expect(creds.user).toBe("user");
        expect(creds.pass).toBe("pass");
        expect(creds.proxyUrl).toBe("http://user:pass@host.com:8080");
    });
    it("returns the URL as-is from buildProxyUrl, ignoring params", () => {
        const creds = { proxyUrl: "http://u:p@h:1", user: "u", pass: "p" };
        const url = GenericHttpAdapter.buildProxyUrl(creds, { country: "US", city: "LA" });
        expect(url).toBe("http://u:p@h:1");
    });
    it("has proxyUrl in sensitiveFields", () => {
        expect(GenericHttpAdapter.sensitiveFields).toContain("proxyUrl");
    });
});
// ─── Smartproxy city targeting ─────────────────────────────
describe("SmartproxyAdapter city targeting", () => {
    it("lowercases city", () => {
        const creds = { user: "u", pass: "p", host: "h", port: "10001" };
        const url = SmartproxyAdapter.buildProxyUrl(creds, { city: "NewYork" });
        expect(url).toContain("-city-newyork");
    });
    it("encodes country + city + session together", () => {
        const creds = { user: "u", pass: "p", host: "h", port: "10001" };
        const url = SmartproxyAdapter.buildProxyUrl(creds, {
            country: "us",
            city: "chicago",
            session_id: "s1",
        });
        expect(url).toContain("u-country-US-city-chicago-session-s1");
    });
});
// ─── Oxylabs city targeting ───────────────────────────────
describe("OxylabsAdapter city targeting", () => {
    it("lowercases city", () => {
        const creds = { user: "u", pass: "p", host: "h", port: "7777" };
        const url = OxylabsAdapter.buildProxyUrl(creds, { city: "London" });
        expect(url).toContain("-city-london");
    });
    it("encodes country + city + session together", () => {
        const creds = { user: "u", pass: "p", host: "h", port: "7777" };
        const url = OxylabsAdapter.buildProxyUrl(creds, {
            country: "gb",
            city: "london",
            session_id: "s1",
        });
        expect(url).toContain("u-cc-GB-city-london-sessid-s1");
    });
});
// ─── Registry / resolveAdapter ────────────────────────────
describe("resolveAdapter", () => {
    it("returns Novada when both Novada and Generic are set", () => {
        const result = resolveAdapter({
            NOVADA_PROXY_USER: "u",
            NOVADA_PROXY_PASS: "p",
            PROXY_URL: "http://u:p@h:1",
        });
        expect(result.adapter.name).toBe("novada");
    });
    it("returns BrightData over Generic when both set", () => {
        const result = resolveAdapter({
            BRIGHTDATA_USER: "u",
            BRIGHTDATA_PASS: "p",
            PROXY_URL: "http://u:p@h:1",
        });
        expect(result.adapter.name).toBe("brightdata");
    });
    it("returns Generic as last resort", () => {
        const result = resolveAdapter({
            PROXY_URL: "http://u:p@h:1",
        });
        expect(result.adapter.name).toBe("generic");
    });
    it("returns null when nothing is configured", () => {
        expect(resolveAdapter({})).toBeNull();
    });
    it("Novada is always first in adapter list", () => {
        const adapters = listAdapters();
        expect(adapters[0].name).toBe("novada");
    });
    it("Generic is always last in adapter list", () => {
        const adapters = listAdapters();
        expect(adapters[adapters.length - 1].name).toBe("generic");
    });
});
