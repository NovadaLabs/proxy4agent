import type { ProxyAdapter, ProxyCredentials, ProxyRequestParams } from "./types.js";

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
export const BrightDataAdapter: ProxyAdapter = {
  name: "brightdata",
  displayName: "BrightData",
  lastVerified: "2026-04-09",
  capabilities: { country: true, city: true, sticky: true },
  credentialDocs:
    "brightdata.com → Proxies & Scraping → Residential → Access Parameters",
  sensitiveFields: ["pass"],

  loadCredentials(env) {
    const user = env.BRIGHTDATA_USER;
    const pass = env.BRIGHTDATA_PASS;
    if (!user || !pass) return null;

    const rawPort = Number(env.BRIGHTDATA_PORT);
    const port = Number.isInteger(rawPort) && rawPort > 0 && rawPort < 65536
      ? rawPort : 22225;

    return {
      user,
      pass,
      host: env.BRIGHTDATA_HOST || "zproxy.lum-superproxy.io",
      port: String(port),
    };
  },

  buildProxyUrl(credentials: ProxyCredentials, params: ProxyRequestParams): string {
    // BrightData appends targeting params to the username with `-` delimiter
    let username = credentials.user;
    if (params.country)    username += `-country-${params.country.toLowerCase()}`;
    if (params.city)       username += `-city-${params.city.toLowerCase()}`;
    if (params.session_id) username += `-sid-${params.session_id}`;
    return `http://${encodeURIComponent(username)}:${encodeURIComponent(credentials.pass)}@${credentials.host}:${credentials.port}`;
  },
};
