export const VERSION = "1.2.0";
// Novada API endpoints — all powered by novada.com
export const NOVADA_SEARCH_URL = "https://scraperapi.novada.com/search";
export const NOVADA_BROWSER_URL = "https://browserapi.novada.com/extract"; // Browser API
export const GATEWAY_URL = "https://gateway.iploop.io:9443/health";
// Proxy layer — Novada's residential network
// Override via env to support infrastructure migrations without a new publish
export const PROXY_HOST = process.env.AGENTPROXY_PROXY_HOST || "proxy.iploop.io";
export const PROXY_PORT = Number(process.env.AGENTPROXY_PROXY_PORT) || 8880;
export const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
//# sourceMappingURL=config.js.map