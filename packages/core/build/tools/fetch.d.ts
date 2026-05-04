import type { ProxyAdapter, ProxyCredentials } from "../adapters/index.js";
/** Returns the configured TTL in seconds. 0 = cache disabled. */
export declare function getCacheTtl(): number;
/** Cache key: url + format + country (country affects what you receive back). */
export declare function makeCacheKey(url: string, format: string, country?: string): string;
/** Clear the entire cache (useful for tests and manual cache invalidation). */
export declare function clearResponseCache(): void;
export interface FetchParams {
    url: string;
    country?: string;
    city?: string;
    session_id?: string;
    format?: "raw" | "markdown";
    timeout?: number;
}
export declare function novadaProxyFetch(params: FetchParams, adapter: ProxyAdapter, credentials: ProxyCredentials): Promise<string>;
export declare function validateFetchParams(raw: Record<string, unknown>): FetchParams;
