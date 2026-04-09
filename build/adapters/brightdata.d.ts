import type { ProxyAdapter } from "./types.js";
/**
 * BrightData residential proxy adapter.
 *
 * BrightData (formerly Luminati) is the largest residential proxy network.
 * This adapter encodes country, city, and session targeting automatically
 * using BrightData's username-suffix format.
 *
 * Auth format:
 *   BASE_USERNAME[-country-XX][-city-CITY][-session-ID]:PASS@HOST:PORT
 *
 * Where BASE_USERNAME is your full BrightData username including zone:
 *   e.g. brd-customer-abc123-zone-residential
 *
 * Get credentials:
 *   brightdata.com → Proxies & Scraping → Residential → Access Parameters
 *
 * Env vars:
 *   BRIGHTDATA_USER  — required (full username, e.g. brd-customer-abc123-zone-residential)
 *   BRIGHTDATA_PASS  — required
 *   BRIGHTDATA_HOST  — optional (default: zproxy.lum-superproxy.io)
 *   BRIGHTDATA_PORT  — optional (default: 22225)
 */
export declare const BrightDataAdapter: ProxyAdapter;
