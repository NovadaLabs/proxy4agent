/**
 * Oxylabs residential proxy adapter.
 *
 * Oxylabs uses a different format: country and city are encoded as
 * `-cc-XX` and `-city-CITY` suffixes. Session stickiness uses `-sessid-ID`.
 *
 * Auth format:
 *   USER[-cc-XX][-city-CITY][-sessid-ID]:PASS@pr.oxylabs.io:PORT
 *
 * Default port: 7777.
 *
 * Get credentials:
 *   oxylabs.io → Dashboard → Residential Proxies → Access Details
 *
 * Env vars:
 *   OXYLABS_USER  — required
 *   OXYLABS_PASS  — required
 *   OXYLABS_HOST  — optional (default: pr.oxylabs.io)
 *   OXYLABS_PORT  — optional (default: 7777)
 */
export const OxylabsAdapter = {
    name: "oxylabs",
    displayName: "Oxylabs",
    lastVerified: "2026-04-09",
    capabilities: { country: true, city: true, sticky: true },
    credentialDocs: "oxylabs.io → Dashboard → Residential Proxies → Access Details",
    sensitiveFields: ["pass"],
    loadCredentials(env) {
        const user = env.OXYLABS_USER;
        const pass = env.OXYLABS_PASS;
        if (!user || !pass)
            return null;
        const rawPort = Number(env.OXYLABS_PORT);
        const port = Number.isInteger(rawPort) && rawPort > 0 && rawPort < 65536
            ? rawPort : 7777;
        return {
            user,
            pass,
            host: env.OXYLABS_HOST || "pr.oxylabs.io",
            port: String(port),
        };
    },
    buildProxyUrl(credentials, params) {
        // Oxylabs uses -cc-XX for country, -city-CITY for city, -sessid-ID for sticky
        let username = credentials.user;
        if (params.country)
            username += `-cc-${params.country.toUpperCase()}`;
        if (params.city)
            username += `-city-${params.city.toLowerCase()}`;
        if (params.session_id)
            username += `-sessid-${params.session_id}`;
        return `http://${encodeURIComponent(username)}:${encodeURIComponent(credentials.pass)}@${credentials.host}:${credentials.port}`;
    },
};
