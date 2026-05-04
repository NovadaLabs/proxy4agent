import type { ProxyAdapter, ProxyCredentials } from "../adapters/index.js";
export interface MapParams {
    url: string;
    limit?: number;
    include_external?: boolean;
    country?: string;
    timeout?: number;
}
/**
 * Crawl a URL and return all internal links found on the page (and optionally
 * linked pages up to limit). This is a shallow map — it fetches the starting URL,
 * extracts all <a href> links, normalises them to absolute URLs, filters to the
 * same domain, and returns the list.
 *
 * For a full sitemap crawl, agents should call novada_proxy_map iteratively on
 * the discovered URLs or use the sitemap.xml directly.
 */
export declare function novadaProxyMap(params: MapParams, adapter: ProxyAdapter, credentials: ProxyCredentials): Promise<string>;
export declare function validateMapParams(raw: Record<string, unknown>): MapParams;
