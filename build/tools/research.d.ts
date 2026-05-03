import type { ProxyAdapter, ProxyCredentials } from "../adapters/index.js";
export interface ResearchParams {
    query: string;
    depth?: "quick" | "standard" | "deep";
    country?: string;
    timeout?: number;
}
export declare function novadaProxyResearch(params: ResearchParams, adapter: ProxyAdapter, credentials: ProxyCredentials, novadaApiKey: string): Promise<string>;
export declare function validateResearchParams(raw: Record<string, unknown>): ResearchParams;
