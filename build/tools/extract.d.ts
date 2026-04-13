import type { ProxyAdapter, ProxyCredentials } from "../adapters/index.js";
export interface ExtractParams {
    url: string;
    fields: string[];
    country?: string;
    city?: string;
    session_id?: string;
    timeout?: number;
    render_fallback?: boolean;
}
export declare function agentproxyExtract(params: ExtractParams, adapter: ProxyAdapter, credentials: ProxyCredentials, browserWsEndpoint?: string): Promise<string>;
export declare function validateExtractParams(raw: Record<string, unknown>): ExtractParams;
