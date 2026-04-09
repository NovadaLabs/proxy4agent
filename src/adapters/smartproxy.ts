import type { ProxyAdapter, ProxyCredentials, ProxyRequestParams } from "./types.js";

/**
 * Smartproxy residential proxy adapter.
 *
 * Smartproxy uses a username-suffix format similar to BrightData but with
 * different segment names. Country is encoded as `-country-XX` (uppercase).
 *
 * Auth format:
 *   USER[-country-XX][-city-CITY][-session-SESSIONID]:PASS@gate.smartproxy.com:PORT
 *
 * Default port: 10001 (rotating). Use 10000 for US-only pool.
 *
 * Get credentials:
 *   smartproxy.com → Dashboard → Residential → Endpoint Generator
 *
 * Env vars:
 *   SMARTPROXY_USER  — required
 *   SMARTPROXY_PASS  — required
 *   SMARTPROXY_HOST  — optional (default: gate.smartproxy.com)
 *   SMARTPROXY_PORT  — optional (default: 10001)
 */
export const SmartproxyAdapter: ProxyAdapter = {
  name: "smartproxy",
  displayName: "Smartproxy",
  lastVerified: "2026-04-09",
  capabilities: { country: true, city: true, sticky: true },
  credentialDocs:
    "smartproxy.com → Dashboard → Residential → Endpoint Generator",
  sensitiveFields: ["pass"],

  loadCredentials(env) {
    const user = env.SMARTPROXY_USER;
    const pass = env.SMARTPROXY_PASS;
    if (!user || !pass) return null;

    const rawPort = Number(env.SMARTPROXY_PORT);
    const port = Number.isInteger(rawPort) && rawPort > 0 && rawPort < 65536
      ? rawPort : 10001;

    return {
      user,
      pass,
      host: env.SMARTPROXY_HOST || "gate.smartproxy.com",
      port: String(port),
    };
  },

  buildProxyUrl(credentials: ProxyCredentials, params: ProxyRequestParams): string {
    // Smartproxy appends targeting params to the username with `-` delimiter
    let username = credentials.user;
    if (params.country)    username += `-country-${params.country.toUpperCase()}`;
    if (params.city)       username += `-city-${params.city.toLowerCase()}`;
    if (params.session_id) username += `-session-${params.session_id}`;
    return `http://${encodeURIComponent(username)}:${encodeURIComponent(credentials.pass)}@${credentials.host}:${credentials.port}`;
  },
};
