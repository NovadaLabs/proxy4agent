import type { ProxyAdapter, ProxyCredentials } from "../adapters/index.js";
export interface CrawlParams {
    url: string;
    depth?: number;
    limit?: number;
    include_content?: boolean;
    country?: string;
    timeout?: number;
    format?: "markdown" | "raw";
}
export interface CrawlPageResult {
    url: string;
    depth: number;
    status_code?: number;
    links_found: number;
    content?: string;
    error?: string;
}
export declare function agentproxyCrawl(params: CrawlParams, adapter: ProxyAdapter, credentials: ProxyCredentials): Promise<string>;
export declare function validateCrawlParams(raw: Record<string, unknown>): CrawlParams;
