import type { ProxyAdapter, ProxyCredentials, ProxyRequestParams } from "./types.js";

/**
 * Novada residential proxy adapter.
 *
 * Auth format: USERNAME-zone-ZONE[-region-XX][-city-CITY][-session-ID-sessTime-N]:PASS@HOST:PORT
 *
 * Rules enforced here (not in tool validators — they handle user-facing input):
 * - Hyphen `-` is Novada's segment delimiter → never appears in country/city/session_id
 *   (enforced upstream in validateFetchParams / validateSessionParams)
 * - session_id → `-session-ID-sessTime-N` suffix (sessTime required for sticky IP)
 * - country → `-region-XX` suffix (lowercased)
 * - city    → `-city-CITY` suffix (lowercased)
 *
 * Env vars:
 *   NOVADA_PROXY_USER  — required
 *   NOVADA_PROXY_PASS  — required
 *   NOVADA_PROXY_HOST  — optional; defaults to super.novada.pro (shared load balancer)
 *                        Set to your account-specific host for reliable sticky sessions.
 *   NOVADA_PROXY_PORT  — optional; defaults to 7777
 *   NOVADA_PROXY_ZONE  — optional; defaults to "res" (residential).
 *                        Other zones: "isp" (rotating ISP), "dcp" (rotating datacenter)
 */
export const NovadaAdapter: ProxyAdapter = {
  name: "novada",
  displayName: "Novada",
  lastVerified: "2026-04-09",
  capabilities: { country: true, city: true, sticky: true },
  credentialDocs:
    "novada.com → Dashboard → Residential Proxies → Endpoint Generator",
  sensitiveFields: ["pass"],

  loadCredentials(env) {
    const user = env.NOVADA_PROXY_USER;
    const pass = env.NOVADA_PROXY_PASS;
    if (!user || !pass) return null;

    const rawPort = Number(env.NOVADA_PROXY_PORT);
    const port = Number.isInteger(rawPort) && rawPort > 0 && rawPort < 65536
      ? rawPort : 7777;

    const zone = env.NOVADA_PROXY_ZONE || "res";

    return {
      user,
      pass,
      host: env.NOVADA_PROXY_HOST || "super.novada.pro",
      port: String(port),
      zone,
    };
  },

  buildProxyUrl(credentials: ProxyCredentials, params: ProxyRequestParams): string {
    const zone = credentials.zone || "res";
    let username = `${credentials.user}-zone-${zone}`;
    if (params.country) username += `-region-${params.country.toLowerCase()}`;
    if (params.city)    username += `-city-${params.city.toLowerCase()}`;
    if (params.session_id) {
      // sessTime is required for sticky IP on all Novada zones.
      // Default: 5 min for res/dcp, 120 min for isp. Max: 120 min res, 360 min isp, 30 min dcp.
      const defaultSessTime = zone === "isp" ? 120 : 5;
      username += `-session-${params.session_id}-sessTime-${defaultSessTime}`;
    }
    return `http://${encodeURIComponent(username)}:${encodeURIComponent(credentials.pass)}@${credentials.host}:${credentials.port}`;
  },
};
