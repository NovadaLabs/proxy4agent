import type { ProxyAdapter } from "./types.js";
/**
 * Generic HTTP Proxy adapter.
 *
 * Set PROXY_URL=http://user:pass@host:port to use any standard HTTP proxy.
 *
 * Compatible with (among others):
 *   BrightData  — https://brightdata.com  (zproxy.lum-superproxy.io:22225)
 *   Smartproxy  — https://smartproxy.com  (gate.smartproxy.com:10001)
 *   Oxylabs     — https://oxylabs.io      (pr.oxylabs.io:7777)
 *   IPRoyal     — https://iproyal.com     (geo.iproyal.com:12321)
 *   Any HTTP CONNECT-capable proxy
 *
 * ⚠️  Country, city, and session_id targeting parameters are NOT automatically
 *     applied — encode them directly in PROXY_URL per your provider's format.
 *     For full targeting support with automatic parameter encoding, use a
 *     provider-specific adapter (e.g. Novada via NOVADA_PROXY_USER/PASS).
 *
 * Examples:
 *   # BrightData with US targeting (encoded in username)
 *   PROXY_URL=http://user-country-us:pass@zproxy.lum-superproxy.io:22225
 *
 *   # Smartproxy with DE targeting
 *   PROXY_URL=http://user-country-DE:pass@gate.smartproxy.com:10001
 *
 *   # Plain proxy (rotating, no targeting)
 *   PROXY_URL=http://user:pass@proxy.example.com:8080
 *
 * Env vars:
 *   PROXY_URL — required. Must start with http:// or https://
 */
export declare const GenericHttpAdapter: ProxyAdapter;
