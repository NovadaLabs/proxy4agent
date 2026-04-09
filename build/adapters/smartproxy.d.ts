import type { ProxyAdapter } from "./types.js";
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
export declare const SmartproxyAdapter: ProxyAdapter;
