import type { ProxyAdapter, ProxyCredentials } from "../adapters/index.js";
export interface BatchFetchParams {
    urls: string[];
    country?: string;
    session_id?: string;
    format?: "markdown" | "raw";
    timeout?: number;
    concurrency?: number;
}
export interface BatchFetchResult {
    url: string;
    ok: boolean;
    status_code?: number;
    content?: string;
    size_bytes?: number;
    cache_hit?: boolean;
    error?: {
        code: string;
        message: string;
    };
    latency_ms: number;
}
export declare function novadaProxyBatchFetch(params: BatchFetchParams, adapter: ProxyAdapter, credentials: ProxyCredentials): Promise<string>;
export declare function validateBatchFetchParams(raw: Record<string, unknown>): BatchFetchParams;
