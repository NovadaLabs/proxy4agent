import type { ProxyAdapter } from "./types.js";
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
export declare const OxylabsAdapter: ProxyAdapter;
